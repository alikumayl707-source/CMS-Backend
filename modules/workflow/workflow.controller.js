    const dashboardService =
    require("./dashboard.service");

    const notificationService =
    require("./notification.service");

    class WorkflowController {

    async dashboard(
        req,
        res,
        next
    ) {
        try {

        const data =
            await dashboardService.getMetrics(
            req.user.id
            );

        res.json({
            success: true,
            data
        });

        } catch (err) {
        next(err);
        }
    }

    async myNotifications(
        req,
        res,
        next
    ) {
        try {

        const data =
            await notificationService.myNotifications(
            req.user.id
            );

        res.json({
            success: true,
            data
        });

        } catch (err) {
        next(err);
        }
    }
    }

    module.exports =
    new WorkflowController();