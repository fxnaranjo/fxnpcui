# Kubernetes Deployment Guide

This guide provides step-by-step instructions for deploying the ChatBot JWT Service application to Kubernetes clusters.


## Prerequisites

### Required Tools

- **oc** (Kubernetes Version: v1.32+) - For Kubernetes deployments
- **jq** - For JSON processing in scripts
- **node** v24.12.0+
- **npm** v11.16.0+

### Required Files

- RSA private key: `keys/jwtRS256.key`
- IBM Watson public key: `keys/ibmPublic.key.pub`

### Access Requirements

- Access to a Kubernetes cluster
- Permissions to create namespaces, deployments, services, and secrets

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                 │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │           Namespace: chatbot-app               │    │
│  │                                                │    │
│  │  ┌──────────────┐      ┌──────────────┐        │    │
│  │  │   Secret     │      │  ConfigMap   │        │    │
│  │  │ (RSA Keys)   │      │  (Config)    │        │    │
│  │  └──────┬───────┘      └──────┬───────┘        │    │
│  │         │                     │                │    │
│  │         └─────────┬───────────┘                │    │
│  │                   ↓                            │    │
│  │         ┌─────────────────────┐                │    │
│  │         │    Deployment       │                │    │
│  │         │  (2 replicas)       │                │    │
│  │         │                     │                │    │
│  │         │  ┌────┐   ┌────┐   │                 │    │
│  │         │  │Pod1│   │Pod2│   │                 │    │
│  │         │  └────┘   └────┘   │                 │    │
│  │         └─────────┬───────────┘                │    │
│  │                   │                            │    │
│  │         ┌─────────▼───────────┐                │    │
│  │         │      Service        │                │    │
│  │         │   (ClusterIP)       │                │    │
│  │         └─────────┬───────────┘                │    │
│  │                   │                            │    │
│  │         ┌─────────▼───────────┐                │    │
│  │         │      Route          │                │    │
│  │         │   (External)        │                │    │
│  │         └─────────────────────┘                │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

## Quick Start

### For Kubernetes

```bash
# 1. Create secrets and RSA keys

-- Login into OpenShift/Kubernetes Cluster

export WXO_ORCHESTRATION_ID=""

export WXO_HOST_URL=""

export WXO_AGENT_ID=""

export WXO_AGENT_ENVIRONMENT_ID=""

-- REPLACE or ADD keys/jwtRS256.key and keys/ibmPublic.key.pub according to your environment

RUN: ./scripts/create-k8s-secret.sh

# 2. Deploy application
RUN: npm run k8s:deploy

# 3. Verify deployment
RUN: oc get all -n chatbot-app

