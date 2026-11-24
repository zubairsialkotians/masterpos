import React from 'react';
import { Screen, SectionTitle, Loading, ErrorBox } from '../components/ui';
import { PlanCard, PlanList, usePlan } from '../components/Plan';

// The shop's plan, this month's orders and items, and the other plans
export default function PlanScreen() {
  const { data: plan, loading, error, reload, refresh, refreshing } = usePlan();
  return (
    <Screen title="Plan" subtitle={plan ? `${plan.name} · ${plan.month}` : ''} onRefresh={refresh} refreshing={refreshing}>
      {loading ? <Loading /> : error || !plan ? <ErrorBox message={error || 'Could not load the plan'} onRetry={reload} /> : (
        <>
          <PlanCard plan={plan} />
          <SectionTitle>Plans</SectionTitle>
          <PlanList plan={plan} />
        </>
      )}
    </Screen>
  );
}
