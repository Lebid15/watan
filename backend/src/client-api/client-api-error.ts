export class ClientApiError extends Error {
  constructor(public codeNumber: number, public clientMessage: string, public original?: any) {
    super(clientMessage);
  }
}

// Helper factories for consistent usage
export const ErrClientApi = {
  missingToken: () => new ClientApiError(120, 'Api Token is required'),
  tokenError: () => new ClientApiError(121, 'Token error'),
  notAllowed: () => new ClientApiError(122, 'Not allowed to use API'),
  ipNotAllowed: () => new ClientApiError(123, 'IP not allowed'),
  maintenance: () => new ClientApiError(130, 'Site under maintenance'),
  productNotFound: () => new ClientApiError(109, 'Product not found'),
  productUnavailable: () => new ClientApiError(110, 'Product not available now'),
  qtyNotAvailable: () => new ClientApiError(105, 'Quantity not available'),
  qtyNotAllowed: () => new ClientApiError(106, 'Quantity not allowed'),
  qtyTooSmall: () => new ClientApiError(112, 'Quantity too small'),
  qtyTooLarge: () => new ClientApiError(113, 'Quantity too large'),
  unknown: () => new ClientApiError(500, 'Unknown error'),
  missingParam: (p: string) => new ClientApiError(114, `Missing param: ${p}`),
  invalidParam: (p: string) => new ClientApiError(114, `Invalid param: ${p}`),
};
