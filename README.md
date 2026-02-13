# Distributed Multi-Tenant Configuration Versioning Platform

Production-ready Node.js system for versioning JSON configurations using MongoDB.

## Features

- **Immutable Versioning** - Every config version is stored with SHA256 checksum
- **Multi-tenant Architecture** - Complete data isolation between organizations
- **Branching & Rollback** - Git-like workflow for configurations
- **Structural Diff** - Automatic comparison between JSON versions
- **Multi-environment Support** - Dev, staging, production environments
- **Audit Trail** - Complete history of all operations
- **RBAC** - Role-based access control (admin, editor, viewer)

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+

### Installation

```bash
cd src
npm install
```

### Configuration

Copy `.env.example` to `.env` and adjust settings:

```bash
cp .env.example .env
```

### Run

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### Docker

```bash
docker-compose up -d
```

## API Endpoints

### Tenants
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants` - List tenants
- `GET /api/v1/tenants/:id` - Get tenant
- `PUT /api/v1/tenants/:id` - Update tenant
- `DELETE /api/v1/tenants/:id` - Deactivate tenant

### Configs
- `POST /api/v1/tenants/:tenantId/configs` - Create config
- `GET /api/v1/tenants/:tenantId/configs` - List configs
- `GET /api/v1/tenants/:tenantId/configs/:configId` - Get config
- `PUT /api/v1/tenants/:tenantId/configs/:configId` - Update config
- `DELETE /api/v1/tenants/:tenantId/configs/:configId` - Archive config

### Versions
- `POST /api/v1/tenants/:tenantId/configs/:configId/versions` - Create version
- `GET /api/v1/tenants/:tenantId/configs/:configId/versions` - List versions
- `GET /api/v1/tenants/:tenantId/configs/:configId/versions/:version` - Get version
- `POST /api/v1/tenants/:tenantId/configs/:configId/rollback` - Rollback
- `POST /api/v1/tenants/:tenantId/configs/:configId/deploy` - Deploy version
- `POST /api/v1/tenants/:tenantId/configs/:configId/branches` - Create branch

### Diff
- `GET /api/v1/tenants/:tenantId/configs/:configId/compare?v1=1&v2=2` - Compare versions
- `POST /api/v1/tenants/:tenantId/configs/:configId/diff` - Compute diff

## Project Structure

```
src/
├── app.js              # Application entry point
├── models/             # MongoDB models
├── services/           # Business logic
├── controllers/        # API controllers
├── routes/             # Express routes
├── middleware/         # Auth, validation, error handling
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
