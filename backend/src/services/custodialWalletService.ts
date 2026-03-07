/**
 * Interface for custodial wallet service operations.
 * Handles secret key decryption and transaction signing.
 */
export interface CustodialWalletService {
  /**
   * Signs a Stellar/Soroban transaction XDR.
   * 
   * @param encryptedSecretKey - The encrypted secret key (format depends on encryption implementation)
   * @param transactionXdr - The transaction XDR string to sign
   * @returns Object containing the signature and public key
   * @throws Error if decryption or signing fails
   */
  signTransaction(
    encryptedSecretKey: string,
    transactionXdr: string,
  ): Promise<{ signature: string; publicKey: string }>
}
