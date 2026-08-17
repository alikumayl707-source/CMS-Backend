class AccessEvaluator {

    evaluateCondition(
        condition,
        user,
        resource
    ) {

        const actualValue =
            user[condition.attribute] ??
            resource?.[condition.attribute];

        switch (condition.operator) {

            case "eq":
                return actualValue === condition.value;

            case "neq":
                return actualValue !== condition.value;

            case "gt":
                return Number(actualValue) >
                    Number(condition.value);

            case "gte":
                return Number(actualValue) >=
                    Number(condition.value);

            case "lt":
                return Number(actualValue) <
                    Number(condition.value);

            case "lte":
                return Number(actualValue) <=
                    Number(condition.value);

           case "in": {
  const list = Array.isArray(condition.value)
    ? condition.value
    : String(condition.value).split(",").map(v => v.trim());
  return list.includes(actualValue);
}

            default:
                return false;
        }
    }

    evaluateRule(
        rule,
        user,
        resource
    ) {

        return rule.conditions.every(
            condition =>
                this.evaluateCondition(
                    condition,
                    user,
                    resource
                )
        );
    }

    evaluateRules(
        rules,
        user,
        resource
    ) {

        const sortedRules = [...rules]
            .sort(
                (a, b) =>
                    b.priority - a.priority
            );

        for (const rule of sortedRules) {

            const matched =
                this.evaluateRule(
                    rule,
                    user,
                    resource
                );

            if (matched) {

                return {
                    allowed:
                        rule.effect === "ALLOW",
                    ruleId: rule.id
                };
            }
        }

        return {
            allowed: false,
            ruleId: null
        };
    }
}

module.exports =
    new AccessEvaluator();