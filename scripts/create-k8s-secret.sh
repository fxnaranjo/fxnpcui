#!/bin/bash

# Script to create Kubernetes/OpenShift Secret for ChatBot Application
# This script reads RSA keys from files and creates a secret

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="chatbot-app"
SECRET_NAME="chatbot-secrets"
PRIVATE_KEY_FILE="keys/jwtRS256.key"
IBM_PUBLIC_KEY_FILE="keys/ibmPublic.key.pub"

# Watson Orchestrate Configuration
# These values should be provided as environment variables or command line arguments
WXO_ORCHESTRATION_ID="${WXO_ORCHESTRATION_ID:-}"
WXO_HOST_URL="${WXO_HOST_URL:-}"
WXO_AGENT_ID="${WXO_AGENT_ID:-}"
WXO_AGENT_ENVIRONMENT_ID="${WXO_AGENT_ENVIRONMENT_ID:-}"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if file exists
check_file() {
    if [ ! -f "$1" ]; then
        print_error "File not found: $1"
        return 1
    fi
    return 0
}

# Function to check if oc is installed
check_oc() {
    if ! command -v oc &> /dev/null; then
        print_error "oc (OpenShift CLI) is not installed. Please install oc first."
        exit 1
    fi
    print_info "oc is installed"
}

# Function to check if namespace exists
check_namespace() {
    if ! oc get namespace "$NAMESPACE" &> /dev/null; then
        print_warning "Namespace '$NAMESPACE' does not exist. Creating it..."
        oc create namespace "$NAMESPACE"
        print_info "Namespace '$NAMESPACE' created"
    else
        print_info "Namespace '$NAMESPACE' exists"
    fi
}

# Function to delete existing secret
delete_existing_secret() {
    if oc get secret "$SECRET_NAME" -n "$NAMESPACE" &> /dev/null; then
        print_warning "Secret '$SECRET_NAME' already exists. Deleting it..."
        oc delete secret "$SECRET_NAME" -n "$NAMESPACE"
        print_info "Existing secret deleted"
    fi
}

# Main script
main() {
    print_info "Starting Secret creation for ChatBot Application"
    echo ""
    
    # Check prerequisites
    check_oc
    
    # Check if key files exist
    print_info "Checking for key files..."
    if ! check_file "$PRIVATE_KEY_FILE"; then
        print_error "Private key file not found: $PRIVATE_KEY_FILE"
        print_info "Please ensure your RSA private key is at: $PRIVATE_KEY_FILE"
        exit 1
    fi
    
    if ! check_file "$IBM_PUBLIC_KEY_FILE"; then
        print_error "IBM public key file not found: $IBM_PUBLIC_KEY_FILE"
        print_info "Please ensure your IBM public key is at: $IBM_PUBLIC_KEY_FILE"
        exit 1
    fi
    
    print_info "Key files found"
    echo ""
    
    # Check/create namespace
    check_namespace
    echo ""
    
    # Delete existing secret if it exists
    delete_existing_secret
    echo ""
    
    # Create the secret
    print_info "Creating secret '$SECRET_NAME' in namespace '$NAMESPACE'..."
    
    # Check if Watson Orchestrate config is provided
    if [ -z "$WXO_ORCHESTRATION_ID" ] || [ -z "$WXO_HOST_URL" ] || [ -z "$WXO_AGENT_ID" ] || [ -z "$WXO_AGENT_ENVIRONMENT_ID" ]; then
        print_warning "Watson Orchestrate configuration not provided via environment variables"
        print_info "Creating secret with RSA keys only..."
        print_info "You can add Watson Orchestrate config later with:"
        print_info "  oc create secret generic $SECRET_NAME \\"
        print_info "    --from-file=PRIVATE_KEY=$PRIVATE_KEY_FILE \\"
        print_info "    --from-file=IBM_PUBLIC_KEY=$IBM_PUBLIC_KEY_FILE \\"
        print_info "    --from-literal=WXO_ORCHESTRATION_ID='your-orchestration-id' \\"
        print_info "    --from-literal=WXO_HOST_URL='your-host-url' \\"
        print_info "    --from-literal=WXO_AGENT_ID='your-agent-id' \\"
        print_info "    --from-literal=WXO_AGENT_ENVIRONMENT_ID='your-agent-env-id' \\"
        print_info "    --namespace=$NAMESPACE --dry-run=client -o yaml | oc apply -f -"
        echo ""
        
        oc create secret generic "$SECRET_NAME" \
            --from-file=PRIVATE_KEY="$PRIVATE_KEY_FILE" \
            --from-file=IBM_PUBLIC_KEY="$IBM_PUBLIC_KEY_FILE" \
            --namespace="$NAMESPACE"
    else
        print_info "Creating secret with RSA keys and Watson Orchestrate configuration..."
        
        oc create secret generic "$SECRET_NAME" \
            --from-file=PRIVATE_KEY="$PRIVATE_KEY_FILE" \
            --from-file=IBM_PUBLIC_KEY="$IBM_PUBLIC_KEY_FILE" \
            --from-literal=WXO_ORCHESTRATION_ID="$WXO_ORCHESTRATION_ID" \
            --from-literal=WXO_HOST_URL="$WXO_HOST_URL" \
            --from-literal=WXO_AGENT_ID="$WXO_AGENT_ID" \
            --from-literal=WXO_AGENT_ENVIRONMENT_ID="$WXO_AGENT_ENVIRONMENT_ID" \
            --namespace="$NAMESPACE"
    fi
    
    if [ $? -eq 0 ]; then
        print_info "Secret created successfully!"
        echo ""
        
        # Verify the secret
        print_info "Verifying secret..."
        oc get secret "$SECRET_NAME" -n "$NAMESPACE"
        echo ""
        
        print_info "Secret keys:"
        oc get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data}' | jq 'keys'
        echo ""
        
        print_info "✅ Secret creation completed successfully!"
    else
        print_error "Failed to create secret"
        exit 1
    fi
}

# Run main function
main
