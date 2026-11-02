import { useParams, useLocation, useRoute } from "wouter";
import { CustomerAttributeView } from "./service-private-pool";

export default function CustomerAttributePage() {
    const [match, params] = useRoute("/customers/attribute/:id");
    const customerId = params?.id;
    const [, setLocation] = useLocation();
    const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialOpenModal = search.get("open") === "account-gm-bv" ? "account_gm_bv" : null;
    const initialGmEntryId = search.get("gmEntryId");

    if (!customerId) {
        return <div className="p-8 text-center text-muted-foreground">No customer ID provided</div>;
    }

    return (
        <CustomerAttributeView 
            customerId={customerId} 
            onBack={() => window.history.back()} 
            backLabel="BACK"
            initialOpenModal={initialOpenModal}
            initialGmEntryId={initialGmEntryId}
        />
    );
}


