function runOld(candidateOrders) {
    let result = false;
    for (const order of candidateOrders) {
        // simulate async delay
        const isReusable = order.reusable;
        if (isReusable) {
            return true;
        }
    }
    return result;
}

// In the previous version, the early exit was lost because we mapped everything and waited for all using Promise.all().
// To keep the early exit optimization and parallelize, we would need to run the queries parallel but abort early when one resolves true.
