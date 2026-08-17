const Joi = require("joi");

module.exports = Joi.object({
    name: Joi.string()
        .min(2)
        .max(50)
        .required(),

    description: Joi.string()
        .allow("")
        .optional()
});