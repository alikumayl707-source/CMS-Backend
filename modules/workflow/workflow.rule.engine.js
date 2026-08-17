class WorkflowRuleEngine {

  evaluate(
    rules,
    payload
  ){

    return rules.every(rule => {

      const value =
        payload[rule.field];

      switch(rule.operator){

        case "equals":
          return value == rule.value;

        case "greaterThan":
          return Number(value) >
                 Number(rule.value);

        case "lessThan":
          return Number(value) <
                 Number(rule.value);

        case "contains":
          return String(value)
            .includes(rule.value);

        default:
          return false;
      }

    });

  }
}

module.exports =
 new WorkflowRuleEngine();