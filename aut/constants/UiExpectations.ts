/**
 * Expected UI text values — all visible strings used in assertions live here.
 * When the AUT changes copy the string here once and all tests update.
 */

export enum LoginMessages {
  ERROR_INVALID_CREDENTIALS = 'Your email or password is incorrect!',
  ERROR_EMAIL_NOT_EXIST     = 'Your email or password is incorrect!',
  LOGGED_IN_AS              = 'Logged in as',
}

export enum SignupMessages {
  ACCOUNT_CREATED     = 'ACCOUNT CREATED!',
  ACCOUNT_DELETED     = 'ACCOUNT DELETED!',
  NAME_ALREADY_EXISTS = 'Email Address already exist!',
}

export enum CartMessages {
  ADDED_TO_CART    = 'Added!',
  CONTINUE_SHOPPING = 'Continue Shopping',
  VIEW_CART        = 'View Cart',
}

export enum CheckoutMessages {
  ORDER_PLACED       = 'ORDER PLACED!',
  CONFIRM_ORDER      = 'Confirm Order',
  ENTER_CARD_DETAILS = 'Enter Credit Card Information',
}

export enum ProductMessages {
  ALL_PRODUCTS  = 'All Products',
  SEARCH_RESULTS = 'Searched Products',
}

export enum PageTitles {
  HOME     = 'Automation Exercise',
  LOGIN    = 'Automation Exercise - Signup / Login',
  PRODUCTS = 'Automation Exercise - All Products',
  CART     = 'Automation Exercise - Checkout',
}

export enum Routes {
  HOME     = '/',
  LOGIN    = '/login',
  PRODUCTS = '/products',
  CART     = '/view_cart',
  CHECKOUT = '/checkout',
}
