declare module '@simplewebauthn/browser' {
  export function startRegistration(options: any): Promise<any>;
  export function startAuthentication(options: any): Promise<any>;
}