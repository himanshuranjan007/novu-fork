import { useEffect, useState } from 'react';
import { Group, Stack, useMantineTheme } from '@mantine/core';
import { Button, Text, When, colors, errorMessage, successMessage } from '@novu/design-system';
import { ApiServiceLevelEnum, FeatureFlagsKeysEnum } from '@novu/shared';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../api';
import { useSegment } from '../../../components/providers/SegmentProvider';
import { PLANS_COLUMN_WIDTH } from '../utils/plansColumnWidths';
import { UpgradeModal } from './UpgradeModal';
import { includedEventQuotaFromApiServiceLevel } from '../utils/plan.constants';
import { ContactSalesModal } from './ContactSalesModal';
import { BillingIntervalControl } from './BillingIntervalControl';
import { useSubscriptionContext } from './SubscriptionProvider';
import { useFeatureFlag } from '../../../hooks';

const black = colors.BGDark;

const columnStyle = {
  padding: '24px',
};

export const PlanHeader = () => {
  const segment = useSegment();

  const {
    isActive,
    trial,
    hasPaymentMethod,
    isLoading: isLoadingSubscriptionData,
    apiServiceLevel: subscriptionApiServiceLevel,
    billingInterval: subscriptionBillingInterval,
  } = useSubscriptionContext();
  const { colorScheme } = useMantineTheme();
  const isDark = colorScheme === 'dark';
  const [intentSecret, setIntentSecret] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isContactSalesModalOpen, setIsContactSalesModalOpen] = useState(false);
  const [intendedApiServiceLevel, setIntendedApiServiceLevel] = useState<ApiServiceLevelEnum | null>(null);
  const [apiServiceLevel, setApiServiceLevel] = useState(
    isLoadingSubscriptionData ? subscriptionApiServiceLevel : ApiServiceLevelEnum.FREE
  );
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(subscriptionBillingInterval || 'month');
  const isImprovedBillingEnabled = useFeatureFlag(FeatureFlagsKeysEnum.IS_IMPROVED_BILLING_ENABLED);
  const isStripeCheckoutEnabled = useFeatureFlag(FeatureFlagsKeysEnum.IS_STRIPE_CHECKOUT_ENABLED);

  const checkoutUrl = isStripeCheckoutEnabled ? '/v1/billing/checkout-session' : '/v1/billing/checkout';

  const checkoutOnSuccess = (data) => {
    if (isStripeCheckoutEnabled) {
      window.location.href = data.stripeCheckoutUrl;

      return;
    }

    if (upgradeOpen) {
      return;
    }

    setIntentSecret(data.clientSecret);
    setUpgradeOpen(true);
  };

  const isPaidSubscriptionActive = isActive && !trial.isActive && apiServiceLevel !== ApiServiceLevelEnum.FREE;

  useEffect(() => {
    if (!isLoadingSubscriptionData) {
      setApiServiceLevel(subscriptionApiServiceLevel);
    }
  }, [isLoadingSubscriptionData, setApiServiceLevel, subscriptionApiServiceLevel]);

  const { mutateAsync: checkout, isLoading: isCheckingOut } = useMutation<
    any,
    any,
    { billingInterval: 'month' | 'year'; apiServiceLevel: ApiServiceLevelEnum }
  >((data) => api.post(checkoutUrl, data), {
    onSuccess: checkoutOnSuccess,
    onError: (e: any) => {
      errorMessage(e.message || 'Unexpected error');
    },
  });

  useEffect(() => {
    if (!isStripeCheckoutEnabled) {
      if (intentSecret === '') {
        return;
      }
      checkout({ billingInterval, apiServiceLevel: ApiServiceLevelEnum.BUSINESS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingInterval, intentSecret, apiServiceLevel]);

  useEffect(() => {
    if (isStripeCheckoutEnabled) {
      const checkoutResult = new URLSearchParams(window.location.search).get('result');

      if (checkoutResult === 'success') {
        setApiServiceLevel(ApiServiceLevelEnum.BUSINESS);
        successMessage('Payment was successful.');
      }

      if (checkoutResult === 'canceled') {
        errorMessage('Order canceled.');
      }
    }
  }, []);

  const { mutateAsync: goToPortal, isLoading: isGoingToPortal } = useMutation<any, any, any>(
    () => api.get('/v1/billing/portal'),
    {
      onSuccess: (url) => {
        window.location.href = url;
      },
      onError: (e: any) => {
        errorMessage(e.message || 'Unexpected error');
      },
    }
  );

  return (
    <>
      <Group align="strech" spacing={0}>
        <div
          style={{
            ...columnStyle,
            background: isDark ? colors.B20 : colors.B98,
            width: PLANS_COLUMN_WIDTH.plan,
          }}
        >
          <Text data-test-id="plan-title" color={isDark ? colors.white : black} weight="bold">
            Plans
          </Text>
        </div>
        <div
          style={{
            ...columnStyle,
            width: PLANS_COLUMN_WIDTH.free,
          }}
        >
          <Group spacing={4} mb={12}>
            <Text mb={2} color={isDark ? colors.white : black} weight="bold">
              Free
            </Text>
            <When truthy={apiServiceLevel === ApiServiceLevelEnum.FREE}>
              <Text data-test-id="plan-free-current" size={12} gradient={true}>
                Current
              </Text>
            </When>
          </Group>
          <Text size={12} color={isDark ? colors.white : black}>
            <b style={{ fontSize: 14 }}>$0</b> free package
          </Text>
          <Text color={isDark ? colors.B80 : colors.B40} size={12}>
            {includedEventQuotaFromApiServiceLevel[ApiServiceLevelEnum.FREE].toLocaleString()} events per month included
          </Text>
        </div>
        <div
          style={{
            ...columnStyle,
            width: PLANS_COLUMN_WIDTH.business,
          }}
        >
          <Stack justify="space-between" h="100%">
            <div>
              <Group spacing={4} mb={12}>
                <Text mb={2} color={isDark ? colors.white : black} weight="bold">
                  Business
                </Text>
                <When truthy={apiServiceLevel === ApiServiceLevelEnum.BUSINESS}>
                  <Text size={12} data-test-id="plan-business-current" gradient={true}>
                    Current
                  </Text>
                </When>
              </Group>
              <When truthy={!isPaidSubscriptionActive}>
                <div style={{ marginBottom: 12 }}>
                  <BillingIntervalControl value={billingInterval} onChange={setBillingInterval} />
                </div>
              </When>
              <Text data-test-id="billing-interval-price" size={12} color={isDark ? colors.white : black}>
                <When truthy={billingInterval === 'month'}>
                  <b style={{ fontSize: 14 }}>$250</b> month package / billed monthly
                </When>
                <When truthy={billingInterval === 'year'}>
                  <b style={{ fontSize: 14 }}>{`$${(2700).toLocaleString()}`}</b> year package / billed annually
                </When>
              </Text>
              <Text size={12} color={isDark ? colors.B80 : colors.B40}>
                {includedEventQuotaFromApiServiceLevel[ApiServiceLevelEnum.BUSINESS].toLocaleString()} events per month
                included
              </Text>
            </div>
            <When truthy={isPaidSubscriptionActive}>
              <Button
                variant="outline"
                loading={isGoingToPortal}
                data-test-id="plan-business-manage"
                onClick={() => {
                  segment.track('Manage Subscription Clicked - Plans List');

                  goToPortal({});
                }}
              >
                Manage subscription
              </Button>
            </When>
            <When truthy={!isPaidSubscriptionActive}>
              <Button
                variant="outline"
                data-test-id="plan-business-upgrade"
                loading={isCheckingOut}
                onClick={() => {
                  checkout({
                    billingInterval,
                    apiServiceLevel: ApiServiceLevelEnum.BUSINESS,
                  });
                }}
              >
                <When truthy={!isImprovedBillingEnabled}>
                  <When truthy={!trial.isActive}>Upgrade</When>
                  <When truthy={trial.isActive && !hasPaymentMethod}>Add payment method</When>
                  <When truthy={trial.isActive && hasPaymentMethod}>Update payment method</When>
                </When>
                <When truthy={isImprovedBillingEnabled}>Upgrade</When>
              </Button>
            </When>
          </Stack>
        </div>
        <div
          style={{
            ...columnStyle,
            width: PLANS_COLUMN_WIDTH.enterprise,
          }}
        >
          <Stack justify="space-between" style={{ height: '100%' }}>
            <div>
              <Group spacing={4} mb={12}>
                <Text mb={2} color={isDark ? colors.white : black} weight="bold">
                  Enterprise
                </Text>
                <When truthy={apiServiceLevel === ApiServiceLevelEnum.ENTERPRISE}>
                  <Text data-test-id="plan-enterprise-current" size={12} gradient={true}>
                    Current
                  </Text>
                </When>
              </Group>
              <Text color={isDark ? colors.B80 : colors.B60}>
                Custom pricing, billing, <br /> and extended services.
              </Text>
            </div>
            <When truthy={apiServiceLevel !== ApiServiceLevelEnum.ENTERPRISE}>
              <Button
                data-test-id="plan-enterprise-contact-sales"
                variant={apiServiceLevel === ApiServiceLevelEnum.BUSINESS ? 'gradient' : 'outline'}
                style={{ width: '100%' }}
                onClick={() => {
                  segment.track('Pricing Enterprise Contact Us Clicked - Plans List');

                  setIntendedApiServiceLevel(ApiServiceLevelEnum.ENTERPRISE);
                  setIsContactSalesModalOpen(true);
                }}
              >
                Contact sales
              </Button>
            </When>
            <When truthy={apiServiceLevel === ApiServiceLevelEnum.ENTERPRISE}>
              <Button
                data-test-id="plan-enterprise-manage"
                variant="outline"
                loading={isGoingToPortal}
                onClick={() => {
                  goToPortal({});
                }}
              >
                Manage subscription
              </Button>
            </When>
          </Stack>
        </div>
      </Group>
      {!isStripeCheckoutEnabled ? (
        <UpgradeModal
          loading={isCheckingOut}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          intentSecret={intentSecret}
          open={upgradeOpen}
          onClose={() => {
            setUpgradeOpen(false);
          }}
          onSucceeded={() => {
            setApiServiceLevel(ApiServiceLevelEnum.BUSINESS);
            setUpgradeOpen(false);
          }}
          onContactSales={() => {
            setUpgradeOpen(false);
            setIntendedApiServiceLevel(ApiServiceLevelEnum.BUSINESS);
            setIsContactSalesModalOpen(true);
          }}
        />
      ) : null}
      <ContactSalesModal
        isOpen={isContactSalesModalOpen}
        onClose={() => {
          setIntendedApiServiceLevel(null);
          setIsContactSalesModalOpen(false);
        }}
        intendedApiServiceLevel={intendedApiServiceLevel || ApiServiceLevelEnum.ENTERPRISE}
      />
    </>
  );
};
