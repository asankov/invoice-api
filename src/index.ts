import { fromHono } from "chanfana";
import { Hono } from "hono";
import { GetCustomers } from "./endpoints/GetCustomers";
import { CreateCustomer } from "./endpoints/CreateCustomer";
import { EditCustomer } from "./endpoints/EditCustomer";

import { GetDashboard } from "./endpoints/GetDashboard";
import { GetInvoices } from "./endpoints/GetInvoices";
import { CreateInvoice } from "./endpoints/CreateInvoice";
import { GetInvoice } from "./endpoints/GetInvoice";
import { EditInvoice } from "./endpoints/EditInvoice";
import { IssueInvoice } from "./endpoints/IssueInvoice";
import { GetInvoicePdf } from "./endpoints/GetInvoicePdf";
import { CreatePayment } from "./endpoints/CreatePayment";
import { GetPayments } from "./endpoints/GetPayments";
import { GetSettings } from "./endpoints/GetSettings";
import { UpdateSettings } from "./endpoints/UpdateSettings";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/docs",
});

openapi.get("/api/dashboard", GetDashboard);

openapi.get("/api/customers", GetCustomers);
openapi.post("/api/customers", CreateCustomer);
openapi.patch("/api/customers/:id", EditCustomer);

openapi.get("/api/invoices", GetInvoices);
openapi.post("/api/invoices", CreateInvoice);
openapi.get("/api/invoices/:id", GetInvoice);
openapi.patch("/api/invoices/:id", EditInvoice);
openapi.post("/api/invoices/:id/issue", IssueInvoice);
openapi.get("/api/invoices/:id/pdf", GetInvoicePdf);

openapi.post("/api/invoices/:id/payments", CreatePayment);
openapi.get("/api/invoices/:id/payments", GetPayments);

openapi.get("/api/settings", GetSettings);
openapi.put("/api/settings", UpdateSettings);

// Export the Hono app
export default app;
