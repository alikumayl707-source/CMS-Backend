const claimTypeRepository =
    require("./claimType.repository");

const AppError = require("../../utils/appError");

class ClaimTypeService {

    async create(data) {

        const existing =
            await claimTypeRepository.findByCode(data.code);

        if (existing) {
            throw new AppError(
                `Claim type with code "${data.code}" already exists`,
                409
            );
        }

        return claimTypeRepository.create(data);
    }

    async getAll(query = {}) {

        return claimTypeRepository.findAll({
            activeOnly: query.activeOnly === "true"
        });
    }

    async getById(id) {

        const claimType =
            await claimTypeRepository.findById(id);

        if (!claimType) {
            throw new AppError("Claim type not found", 404);
        }

        return claimType;
    }

 async getByCode(code) {

    const claimType =
        await claimTypeRepository.findByCode(code);

    if (!claimType) {
        throw new AppError("Claim type not found", 404);
    }



    return claimType;
}
convertSchema(schema) {

    return {
        rows: schema.fields.map(field => [
            {
                label: field.label ?? field.name,
                controlName: field.name,
                type: field.type,
                validators: field.required                 // was "validations"
                    ? [{
                        type: "required",
                        message: `${field.name} is required`
                    }]
                    : []
            }
        ])
    };
}

    async update(id, data) {

        await this.getById(id);

        return claimTypeRepository.update(id, data);
    }

    async delete(id) {

        await this.getById(id);

        return claimTypeRepository.delete(id);
    }

}

module.exports = new ClaimTypeService();
