export async function withTransactionRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "code" in error &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt >= 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    }
  }
}
