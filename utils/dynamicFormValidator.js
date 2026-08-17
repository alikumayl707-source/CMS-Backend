const SUPPORTED_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox', 'radiobutton', 'password'];

class DynamicFormValidator {

validate(schema, formData = {}, { partial = false } = {}) {
    const errors = [];
    const fields = (schema?.rows ?? []).flat();
    this.validateFields(fields, formData, partial, errors, '');
    return { valid: errors.length === 0, errors };
}

validateFields(fields, formData, partial, errors, path) {
    fields.forEach(field => {
        const fieldPath = path ? `${path}.${field.controlName}` : field.controlName;

        if (field.type === 'group') {
            const childData = formData?.[field.controlName] ?? {};
            this.validateFields(field.children ?? [], childData, partial, errors, fieldPath);
            return;
        }

        if (field.type === 'array') {
            const items = formData?.[field.controlName] ?? [];
            const minItems = field.arrayMinItems ?? 0;

            if (!partial && items.length < minItems) {
                errors.push(`${field.label} requires at least ${minItems} item(s)`);
            }

            items.forEach((item, idx) => {
                this.validateFields(field.children ?? [], item, partial, errors, `${fieldPath}[${idx}]`);
            });
            return;
        }

        const value = formData[field.controlName];
        const isEmpty = value === undefined || value === null || value === '';
        const validators = field.validators ?? [];
        const requiredRule = validators.find(v => v.type === 'required');

        if (isEmpty) {
            if (!partial && requiredRule) {
                errors.push(requiredRule.message ?? `${field.label || fieldPath} is required`);
            }
            return;
        }

        errors.push(...this.validateField(field, value, validators, fieldPath));
    });
}

validateField(field, value, validators, fieldPath) {
    const errors = [];
    if (!SUPPORTED_TYPES.includes(field.type)) return errors;

    for (const rule of validators) {
        switch (rule.type) {
            case 'minLength':
                if (String(value).length < Number(rule.value)) errors.push(rule.message ?? `${field.label} too short`);
                break;
            case 'maxLength':
                if (String(value).length > Number(rule.value)) errors.push(rule.message ?? `${field.label} too long`);
                break;
            case 'min':
                if (Number(value) < Number(rule.value)) errors.push(rule.message ?? `${field.label} too small`);
                break;
            case 'max':
                if (Number(value) > Number(rule.value)) errors.push(rule.message ?? `${field.label} too large`);
                break;
            case 'pattern':
                if (!(new RegExp(String(rule.value))).test(String(value))) errors.push(rule.message ?? `${field.label} invalid format`);
                break;
        }
    }
    return errors;
}
}

module.exports = new DynamicFormValidator();