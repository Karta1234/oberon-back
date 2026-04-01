# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # install dependencies
npx prisma generate        # generate Prisma Client (required after clone, output: generated/prisma/)
npx prisma migrate dev     # apply migrations in development
npm run start:dev          # start in watch mode (port from PORT env or 3000)
npm run build              # build to dist/
npm run start:prod         # run compiled dist/main.js
npm run test               # unit tests (Jest, rootDir: src)
npm run test -- --testPathPattern=auth  # run tests matching pattern
npm run test:e2e           # e2e tests (uses test/jest-e2e.json)
npm run test:cov           # coverage report
npm run lint               # ESLint with --fix
npm run format             # Prettier --write
```

## Architecture

NestJS 11 REST API with PostgreSQL (Prisma ORM 7) and JWT authentication via httpOnly cookies. Includes AI image generation via Polza AI, wallet/balance system, and payment integration.

### Module structure

```
AppModule
├── ConfigModule (global) — reads .env
├── PrismaModule (global) — exports PrismaService singleton
├── StorageModule (global) — S3/MinIO file storage (upload, download, presigned URLs)
├── AccountModule — DB access layer (create, findByEmail, findById)
├── AuthModule — business logic (register, login, logout, me)
│    ├── imports AccountModule
│    ├── JwtModule (async config from ConfigService)
│    ├── PassportModule + JwtStrategy
│    └── AuthController + AuthService
├── WalletModule — balance & transactions (getBalance, topUp, charge, refund)
│    ├── WalletService (Prisma $transaction for atomic balance ops)
│    └── WalletController (GET /wallet/balance, GET /wallet/transactions)
├── GenerationModule — AI image generation via Polza AI
│    ├── imports WalletModule
│    ├── PolzaApiService (HTTP client for Polza AI /v1/media)
│    ├── GenerationService (orchestration: upload → call API → poll → save result → charge)
│    └── GenerationController (POST /generation, GET /generation/:id, GET /generation/history)
└── PaymentModule — payment processing (YooMoney stub)
     ├── imports WalletModule
     ├── PAYMENT_PROVIDER token → YooMoneyStubProvider
     ├── PaymentService (create payment, handle webhook → topUp wallet)
     └── PaymentController (POST /payment/create, POST /payment/webhook)
```

Each feature is a separate module with `module` + `service` + `controller` + `dto/` files. `PrismaModule` is imported by any module needing DB access. `StorageModule` is global. Data access lives in entity services (like `AccountService`), business logic in feature services (like `AuthService`).

### Global middleware (registered in main.ts)

- `cookie-parser` — parses cookies for JWT extraction
- `ValidationPipe({ whitelist: true })` — strips unknown fields, validates DTOs
- `HttpExceptionFilter` — normalizes all errors to `{ success, statusCode, message, errors? }`
- `ResponseInterceptor` — wraps successful responses in `{ success: true, data }`

### Auth flow

JWT is stored in httpOnly cookie `access_token` (not Authorization header). `JwtStrategy` extracts token from `req.cookies.access_token`. Cookie flags: `httpOnly`, `secure` in production, `sameSite: 'strict'`, 24h maxAge. Protected routes use `@UseGuards(JwtAuthGuard)`.

### Generation flow

1. Client sends POST /generation with roomImage, furnitureImages, prompt
2. Server checks minimum balance, creates Generation record (status: uploading)
3. Background process (fire-and-forget): uploads images to MinIO, calls Polza AI async, polls every 4s (max 150 attempts / 10 min)
4. On completion: downloads result → stores in MinIO → charges wallet (cost + markup) → updates status
5. Client polls GET /generation/:id until status is completed/failed

### Prisma setup

Uses `@prisma/adapter-pg` driver adapter (not native). Client generated to `generated/prisma/` (non-standard path, gitignored). Schema at `prisma/schema.prisma`, config at `prisma.config.ts`.

Models: Account, Generation, Transaction, Payment. Enums: GenerationStatus, TransactionType, PaymentStatus.

## Environment variables (.env)

```
DATABASE_URL=postgresql://user:pass@host:5432/db   # required
JWT_SECRET=your-secret-key                          # required (getOrThrow)
PORT=3000                                           # optional, default 3000
NODE_ENV=development                                # optional, affects cookie secure flag

# MinIO / S3
S3_ENDPOINT=http://localhost:9000                   # required (getOrThrow)
S3_ACCESS_KEY=minioadmin                            # required (getOrThrow)
S3_SECRET_KEY=minioadmin                            # required (getOrThrow)
S3_REGION=us-east-1                                 # optional, default us-east-1
S3_BUCKET_PREFIX=oberon                             # optional, default oberon

# Polza AI
POLZA_API_BASE_URL=https://polza.ai/api             # required (getOrThrow)
POLZA_API_KEY=your-polza-api-key                    # required (getOrThrow)

# Pricing
GENERATION_MARKUP_PERCENT=30                        # optional, default 30

# YooMoney (stub)
YOOMONEY_SHOP_ID=stub
YOOMONEY_SECRET_KEY=stub
YOOMONEY_RETURN_URL=http://localhost:5173/oberon/wallet
```

## Conventions

- User-facing messages (validation, errors) are in Russian
- Response format: success `{ success: true, data }`, error `{ success: false, statusCode, message, errors? }`
- Validation errors return `errors` array; single errors have only `message`
- Code style: single quotes, trailing commas (see .prettierrc)
- Prisma imports: use `generated/prisma/client` path (baseUrl is `./` in tsconfig)
- E2e tests in `test/` do not currently apply global middleware — must be added manually in test setup when testing auth routes
