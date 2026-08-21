  const claimService =
      require("./claim.service");

  const claimRepository =
    require("./claim.repository");

  const claimWorkflow  =
    require("./claims.workflow");
        const workflowService =
 require("../claimWorkFlow/workflow-dashboard.service");
const path = require("path");

  class ClaimController {

async getWorkflow(req,res,next){
  try{

    const data =
      await workflowService.getClaimWorkflow(
        Number(req.params.id)
      );

    res.json({
      success:true,
      data
    });

  }catch(err){
    next(err);
  }
}
    async deleteDocument(req, res, next) {

      try {

          await claimService.deleteDocument(
              Number(req.params.id),
              Number(req.params.docId)
          );

          return res.json({
              success: true
          });

      } catch (error) {

          next(error);

      }

  }
  async getDocumentStatus(req, res, next) {

      try {

          const document =
              await claimService.getDocumentStatus(
                  Number(req.params.id),
                  Number(req.params.docId)
              );

          return res.json({
              success: true,
              data: document
          });

      } catch (error) {

          next(error);

      }

  }

  async review(req, res, next) {
      try {
          const claim = req.resource; 
          const result = await claimWorkflow.review(claim, req.user);
          return res.json({ success: true, data: result });
      } catch (error) {
          next(error);
      }
  }
async approve(req, res, next) {
  try {
    const claim = req.resource;

    const result = await claimWorkflow.approve(
      claim,
      req.user,
      req.body.comments,
      req.body.lineItemDecisions   // ← NEW
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("APPROVE ERROR:", error);
    next(error);
  }
}
  async cancel(
  req,
  res,
  next
  ){
  try{

    const result =
    await claimWorkflow.cancel(
      req.resource,
      req.user
    );

    res.json({
      success:true,
      data:result
    });

  }catch(err){
    next(err);
  }
  }
  async reject(req, res, next) {
      try {
          const claim = req.resource;
          const result = await claimWorkflow.reject(claim, req.user, req.body.comments);
          return res.json({ success: true, data: result });
      } catch (error) {
          next(error);
      }
  }

  async getAll(req, res, next) {

      try {

        const result =
    await claimService.getAll({
      ...req.query,
      search: req.query.search
    });

          res.json({
              success: true,
              data: result.data,
              pagination: result.pagination
          });

      } catch (error) {

          next(error);

      }

  }

    async listMyDrafts(req, res, next) {

      try {

        const drafts = await claimService.listMyDrafts(
          req.user.id
        );

        return res.json({
          success: true,
          data: drafts
        });

      } catch (error) {
        next(error);
      }
    }

    async checkDuplicate(req, res, next) {

      try {

        const result = await claimService.checkDuplicate(
          req.body,
          req.body.id ? Number(req.body.id) : undefined
        );

        return res.json({
          success: true,
          data: result
        });

      } catch (error) {
        next(error);
      }
    }

    async getById(req, res, next) {

      try {

        const claim = await claimService.getById(
          Number(req.params.id)
        );

        return res.json({
          success: true,
          data: claim
        });

      } catch (error) {
        next(error);
      }
    }

    async saveDraft(req, res, next) {

      try {

        const claim = await claimService.saveDraft(
          req.user.id,
          req.body
        );

        return res.status(201).json({
          success: true,
          data: claim
        });

      } catch (error) {
        next(error);
      }
    }

    async deleteDraft(req, res, next) {

      try {

        await claimService.deleteDraft(
          Number(req.params.id),
          req.user.id
        );

        return res.json({
          success: true
        });

      } catch (error) {
        next(error);
      }
    }
  async returnForCorrection(
    req,
    res,
    next
  ) {
    try {

      const result =
        await claimWorkflow
          .returnForCorrection(
            req.resource,
            req.user,
            req.body.comments
          );

      res.json({
        success: true,
        data: result
      });

    } catch (err) {
      next(err);
    }
  }
async submit(req, res, next) {
  try {
    const result = await claimService.submit(req.user.id, req.body);
    res.locals.entityId = result.claim.id;   
    return res.status(201).json({ success: true, data: result.claim, warning: result.duplicateWarning });
  } catch (error) { next(error); }
}
  async resubmit(req, res, next) {
      try {
          const result = await claimService.resubmitAfterRejection(req.user.id, req.body);
          return res.status(201).json({ success: true, data: result.claim, warning: result.duplicateWarning });
      } catch (error) {
          next(error);
      }
  }
  async addDocuments(req, res, next) {
      try {
          const documents = await claimService.addDocuments(
              Number(req.params.id),
              req.files,
              req.user.id,
              req.body.documentTypeId   
          );
          return res.status(201).json({ success: true, data: documents });
      } catch (error) {
          next(error);
      }
  }
async downloadDocument(
  req,
  res,
  next
) {

  try {

    const document =
      await claimRepository.findDocument(
        Number(req.params.id),
        Number(req.params.docId)
      );

    if (!document) {

      return res.status(404).json({
        success:false,
        message:"Document not found"
      });

    }

    return res.download(
      document.filePath,
      document.originalName
    );

  } catch(err) {

    next(err);

  }

}
    async getDocuments(req, res, next) {

      try {

        const documents = await claimService.getDocuments(
          Number(req.params.id)
        );

        return res.json({
          success: true,
          data: documents
        });

      } catch (error) {
        next(error);
      }
    }

  
  }

  module.exports = new ClaimController();