declare global {
  interface Window {
    webln?: {
      enable(): Promise<void>;
      sendPayment(paymentRequest: string): Promise<{
        preimage: string;
      }>;
      makeInvoice(args: {
        amount?: number;
        defaultMemo?: string;
      }): Promise<{
        paymentRequest: string;
      }>;
      signMessage(message: string): Promise<{
        message: string;
        signature: string;
      }>;
      verifyMessage(signature: string, message: string): Promise<void>;
      getInfo(): Promise<{
        node: {
          alias: string;
          pubkey: string;
          color?: string;
        };
      }>;
    };
  }
}

export {};