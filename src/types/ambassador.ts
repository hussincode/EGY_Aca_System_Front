export interface Ambassador {
  AmbName: string;
  AmbPhone: string;
  RefCode: string;
  Ambstatus: 'Active' | 'Inactive';
}

export interface ReferredPlayer {
  AmbId: string;
  Name: string;
  Age: number;
  Sport: string;
  Activity: string;
  Subscription: {
    plan: string;
    status: string;
    value: number;
  };
  Joined: boolean;
  RefPointsCounted: boolean;
  JoinedDate: string;
  Joinedpoints?: number;
}