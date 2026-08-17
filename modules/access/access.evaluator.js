class AccessEvaluator {

  evaluateCondition(
    condition,
    user,
    resource
  ) {

    if (condition.operator === "approvalLimit") {
      return (
        Number(resource.amount) <=
        this.effectiveApprovalLimit(user)
      );
    }

    if (condition.operator === "approvalLimit70") {
      return (
        Number(resource.amount) <=
        (this.effectiveApprovalLimit(user) * 0.70)
      );
    }

    const actualValue =
      this.resolveAttributeValue(condition, user, resource);

    switch (condition.operator) {

      case "equals":
        return actualValue === condition.value;

      case "statusEquals":
        return resource.status === condition.value;

      case "reviewNotCreator":
        return resource.createdBy !== user.id;

      case "owner":
        return Number(resource.createdBy) === Number(user.id);

      case "notEquals":
        return actualValue !== condition.value;

      case "greaterThan":
        return Number(actualValue) > Number(condition.value);

      case "lessThan":
        return Number(actualValue) < Number(condition.value);

      case "in":
        return Array.isArray(condition.value)
          ? condition.value.includes(actualValue)
          : String(condition.value)
              .split(",")
              .map(v => v.trim())
              .includes(actualValue);

      default:
        return false;
    }
  }

  resolveAttributeValue(condition, user, resource) {

    const source =
      condition.target === "USER" ? user : resource;

    switch (condition.attribute) {

      case "department":
        return source.department?.name ?? source.department ?? undefined;

      case "designation":
        return source.designation?.name ?? source.designation ?? undefined;

      default:
        return source[condition.attribute];
    }
  }

  effectiveApprovalLimit(user) {
    return Number(
      user.approvalLimit ??
      user.designation?.defaultApprovalLimit ??
      0
    );
  }

}

module.exports =
  new AccessEvaluator();