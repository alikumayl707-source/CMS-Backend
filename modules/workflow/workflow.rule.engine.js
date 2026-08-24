class WorkflowRuleEngine {

  evaluate(rules, payload) {
    if (!Array.isArray(rules) || rules.length === 0) return false;

    const groups = new Map();

    for (const rule of rules) {
      const key = rule.conditionGroup ?? `__ungrouped_${rule.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rule);
    }

    for (const groupRules of groups.values()) {
      const allMatch = groupRules.every(rule =>
        this.evaluateCondition(rule, payload)
      );
      if (allMatch) return true;
    }

    return false;
  }

  evaluateCondition(rule, payload) {

    const actualValue = payload?.[rule.field];

    if (actualValue === undefined) return false;

    switch (rule.operator) {

      case "eq":
      case "equals":
        return String(actualValue) === String(rule.value);

      case "neq":
      case "notEquals":
        return String(actualValue) !== String(rule.value);

      case "gt":
        return Number(actualValue) > Number(rule.value);

      case "gte":
        return Number(actualValue) >= Number(rule.value);

      case "lt":

        return Number(actualValue) < Number(rule.value);

      case "lte":
        return Number(actualValue) <= Number(rule.value);

      case "in": {
        const list = Array.isArray(rule.value)
          ? rule.value
          : String(rule.value).split(",").map(v => v.trim());
        return list.includes(String(actualValue));
      }

      default:
        return false;
    }
  }
}

module.exports = new WorkflowRuleEngine();