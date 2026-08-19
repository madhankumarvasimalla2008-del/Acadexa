export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function toAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function paymentStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "successful":
      return "Successful";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

export function packTypeLabel(value: string) {
  switch (value) {
    case "book_pack":
      return "Book Pack";
    case "uniform_pack":
      return "Uniform Pack";
    case "complete_pack":
      return "Complete Pack";
    case "custom_pack":
      return "Custom Pack";
    default:
      return value;
  }
}
