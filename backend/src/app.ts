import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import {
  localizedApiError,
  localizedValidationError,
} from './modules/localization/api-errors.js';
import type { AppConfig } from './config/env.js';
import { createPrismaClient } from './lib/prisma.js';
import { AuthorizationError } from './modules/identity/authorization.js';
import {
  AccountLockedError,
  AuthenticationError,
  InactiveUserError,
  MfaChallengeRequiredError,
  MfaEnrollmentRequiredError,
} from './modules/identity/auth.service.js';
import { registerHealthRoutes } from './routes/health.js';
import { InventoryBusinessError } from './modules/inventory/inventory.service.js';
import { registerInventoryRoutes } from './routes/inventory.js';
import { registerCatalogRoutes } from './routes/catalog.js';
import { registerIdentityRoutes } from './routes/identity.js';
import { registerPharmacyRoutes } from './routes/pharmacy.js';
import { registerPurchasingRoutes } from './routes/purchasing.js';
import { PurchasingBusinessError } from './modules/purchasing/purchasing.service.js';
import { PosBusinessError } from './modules/pos/pos.service.js';
import { registerPosRoutes } from './routes/pos.js';
import { registerPatientRoutes } from './routes/patients.js';
import { PatientBusinessError } from './modules/patients/patients.service.js';
import { registerPrescriptionRoutes } from './routes/prescriptions.js';
import { PrescriptionBusinessError } from './modules/prescriptions/prescriptions.service.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerReportingRoutes } from './routes/reporting.js';
import {
  registerTransferRoutes,
  TransferBusinessError,
} from './routes/transfers.js';

export function buildApp(config: AppConfig, database?: PrismaClient) {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });
  const prisma = database ?? createPrismaClient();
  const ownsDatabase = database === undefined;

  app.register(sensible);
  app.register(cookie, { secret: config.SESSION_SECRET });
  app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send(localizedValidationError(request, error));
    }
    if (error instanceof AuthenticationError) {
      return reply
        .code(401)
        .send(
          localizedApiError(
            request,
            'INVALID_CREDENTIALS',
            'invalidCredentials',
          ),
        );
    }
    if (error instanceof InactiveUserError) {
      return reply
        .code(403)
        .send(localizedApiError(request, 'USER_INACTIVE', 'userInactive'));
    }
    if (error instanceof AccountLockedError) {
      return reply
        .code(423)
        .send(localizedApiError(request, 'ACCOUNT_LOCKED', 'accountLocked'));
    }
    if (error instanceof MfaChallengeRequiredError) {
      return reply.code(401).send({
        error: 'MFA_REQUIRED',
        challengeToken: error.challengeToken,
      });
    }
    if (error instanceof MfaEnrollmentRequiredError) {
      return reply
        .code(403)
        .send({ error: 'MFA_ENROLLMENT_REQUIRED' });
    }
    if (error instanceof PrescriptionBusinessError) {
      return reply
        .code(400)
        .send(
          localizedApiError(
            request,
            'PRESCRIPTION_BUSINESS_RULE',
            'prescriptionRule',
          ),
        );
    }
    if (error instanceof PatientBusinessError) {
      return reply
        .code(400)
        .send(
          localizedApiError(request, 'PATIENT_BUSINESS_RULE', 'patientRule'),
        );
    }
    if (error instanceof PosBusinessError) {
      return reply
        .code(400)
        .send(localizedApiError(request, 'POS_BUSINESS_RULE', 'posRule'));
    }
    if (error instanceof PurchasingBusinessError) {
      return reply
        .code(400)
        .send(
          localizedApiError(
            request,
            'PURCHASING_BUSINESS_RULE',
            'purchasingRule',
          ),
        );
    }
    if (error instanceof TransferBusinessError) {
      return reply
        .code(400)
        .send(
          localizedApiError(
            request,
            'INVENTORY_TRANSFER_RULE',
            'inventoryRule',
          ),
        );
    }
    if (error instanceof InventoryBusinessError) {
      return reply
        .code(400)
        .send(
          localizedApiError(
            request,
            'INVENTORY_BUSINESS_RULE',
            'inventoryRule',
          ),
        );
    }
    if (error instanceof AuthorizationError) {
      const requiresAuthentication =
        error.message === 'Authentication required';
      return reply
        .code(requiresAuthentication ? 401 : 403)
        .send(
          localizedApiError(
            request,
            requiresAuthentication ? 'AUTHENTICATION_REQUIRED' : 'FORBIDDEN',
            requiresAuthentication ? 'authenticationRequired' : 'forbidden',
          ),
        );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return reply
        .code(409)
        .send(
          localizedApiError(
            request,
            'RESOURCE_ALREADY_EXISTS',
            'alreadyExists',
          ),
        );
    }
    if (
      error instanceof Error &&
      error.message === 'Organization bootstrap has already been completed'
    ) {
      return reply.code(409).send({ error: 'BOOTSTRAP_ALREADY_COMPLETED' });
    }
    request.log.error({ err: error }, 'unhandled request error');
    return reply
      .code(500)
      .send(localizedApiError(request, 'INTERNAL_SERVER_ERROR', 'internal'));
  });
  app.register(
    async (instance) => {
      registerHealthRoutes(instance, prisma);
      registerIdentityRoutes(
        instance,
        prisma,
        config.NODE_ENV === 'production',
      );
      registerPharmacyRoutes(instance, prisma);
      registerCatalogRoutes(instance, prisma);
      registerInventoryRoutes(instance, prisma);
      registerPurchasingRoutes(instance, prisma);
      registerPosRoutes(instance, prisma);
      registerPatientRoutes(instance, prisma);
      registerPrescriptionRoutes(instance, prisma);
      registerDocumentRoutes(instance, prisma);
      registerReportingRoutes(instance, prisma);
      registerTransferRoutes(instance, prisma);
    },
    { prefix: '/api/v1' },
  );

  app.addHook('onClose', async () => {
    if (ownsDatabase) await prisma.$disconnect();
  });

  return app;
}
