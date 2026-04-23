export interface HealedSelector {
  original: string;
  healed: string;
  url: string;
  confidence: number;
  timestamp: string;
}

export interface HealedSelectorsCache {
  [key: string]: HealedSelector;
}

export interface SelectorAlternative {
  selector: string;
  confidence: number;
  reasoning: string;
}

export interface VisualDifference {
  element: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  region?: string;
}

export interface VisualComparisonResult {
  passed: boolean;
  differences: VisualDifference[];
  summary: string;
  confidence: number;
}

export interface GeneratedUser {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  address: {
    company?: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  dateOfBirth: {
    day: number;
    month: number;
    year: number;
  };
}

export interface GeneratedProduct {
  title: string;
  price: number;
  description: string;
  category: string;
  searchTerms: string[];
}

export interface GeneratedTestSpec {
  code: string;
  filename: string;
  testCount: number;
}

export type TestDataType = 'user' | 'product' | 'searchTerms';
