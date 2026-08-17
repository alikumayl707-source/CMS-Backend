const Joi = require("joi");

const claimDraftValidation = Joi.object({

    id: Joi.string()
        .optional(),

    claimTypeCode: Joi.string()
        .required(),

    policyNumber: Joi.string()
        .allow("")
        .optional(),

    customerId: Joi.number()
        .optional(),

    incidentDate: Joi.date()
        .optional(),

    formData: Joi.object()
        .unknown(true)
        .default({})

});


const claimSubmitValidation = Joi.object({

    id: Joi.string()
        .required(),

    overrideDuplicateWarning: Joi.boolean()
        .default(false),

    overrideReason: Joi.string()
        .allow("")
        .optional()

});

module.exports = {
    claimDraftValidation,
    claimSubmitValidation
};