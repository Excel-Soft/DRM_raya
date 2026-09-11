import { Router, Request, Response } from "express";

const router = Router();

router.get("/ui-config", (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Stub implementation
    res.json({
        success: true,
        data: {
            verificationManagerRequiredAfterQa: true,
            serviceExecutiveCanCreateGM: true,
            serviceExecutiveCanCreateManualInvoice: true
        }
    });
});

export const gmSalesWorkflowRouter = router;
