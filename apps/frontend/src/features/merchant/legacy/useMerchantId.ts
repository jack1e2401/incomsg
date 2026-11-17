import { useParams } from "react-router-dom";

export const useMerchantId = () => useParams().merchantId ?? "moc";
