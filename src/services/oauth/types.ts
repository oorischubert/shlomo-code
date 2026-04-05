export type BillingType = string
export type SubscriptionType = string

export type OAuthProfileResponse = {
  account: {
    uuid: string
    email: string
    display_name?: string | null
    created_at?: string
    [key: string]: unknown
  }
  organization: {
    uuid?: string
    billing_type?: BillingType | null
    has_extra_usage_enabled?: boolean | null
    subscription_created_at?: string | null
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  scopes?: string[]
  profile?: OAuthProfileResponse | null
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type ReferralEligibilityResponse = Record<string, unknown>
export type ReferralRedemptionsResponse = Record<string, unknown>
export type ReferrerRewardInfo = Record<string, unknown>

