import { Router, type Request, type Response, type NextFunction } from "express";
import { validate } from "../middleware/validate.js";
import { whistleblowerSignupApplicationStore } from "../models/whistleblowerSignupApplicationStore.js";
import { createWhistleblowerSignupApplicationSchema } from "../schemas/whistleblowerSignupApplication.js";

export function createWhistleblowerApplicationsRouter(): Router {
  const router = Router();

  router.post(
    "/",
    validate(createWhistleblowerSignupApplicationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const application = await whistleblowerSignupApplicationStore.create(
          req.body,
        );
        res.status(201).json({
          success: true,
          data: {
            applicationId: application.applicationId,
            status: application.status,
            createdAt: application.createdAt,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
