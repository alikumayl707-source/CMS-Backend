const Joi = require("joi");

const fieldSchema = Joi.object({

    key: Joi.string()
        .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
        .required(),

    label: Joi.string()
        .required(),

    type: Joi.string()
        .valid(
            "text",
            "textarea",
            "number",
            "date",
            "boolean",
            "select",
            "multiselect",
            "email",
            "phone"
        )
        .required(),

    required: Joi.boolean()
        .default(false),

    minLength: Joi.number()
        .optional(),

    maxLength: Joi.number()
        .optional(),

    min: Joi.number()
        .optional(),

    max: Joi.number()
        .optional(),

    pattern: Joi.string()
        .optional(),

    options: Joi.array()
        .items(Joi.string())
        .when("type", {
            is: Joi.valid("select", "multiselect"),
            then: Joi.required(),
            otherwise: Joi.optional()
        })

});

const claimTypeValidation = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    code: Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/).min(2).max(50).required(),
    description: Joi.string().allow("").optional(),
    schema: Joi.object({
        rows: Joi.array().items(Joi.array().items(Joi.object().unknown(true))).required()
    }).required(),
    isActive: Joi.boolean().optional()
});

module.exports = claimTypeValidation;
