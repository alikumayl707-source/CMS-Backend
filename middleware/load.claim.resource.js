const claimRepository =
 require("../modules/claims/claim.repository");

const loadClaimResource = async (req, res, next) => {

  try {

    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid claim id"
      });
    }

    const claim = await claimRepository.findById(id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found"
      });
    }

    req.resource = claim;

    next();

  } catch (err) {
    next(err);
  }

};

module.exports = loadClaimResource;
