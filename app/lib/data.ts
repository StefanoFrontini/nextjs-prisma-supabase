import { formatCurrency } from "./utils";
import { PrismaClient, Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
const prisma = new PrismaClient();

export async function fetchRevenue() {
  // Add noStore() here prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();

  try {
    // Artificially delay a reponse for demo purposes.
    // Don't do this in real life :)

    // console.log("Fetching revenue data...");
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    // const data = await sql<Revenue>`SELECT * FROM revenue`;

    // console.log("Data fetch complete after 3 seconds.");

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await prisma.invoice.findMany({
      take: 5,
      orderBy: {
        date: "desc",
      },
      select: {
        amount: true,
        id: true,
        customer: {
          select: {
            name: true,
            imageUrl: true,
            email: true,
          },
        },
      },
    });
    // const data = await sql<LatestInvoiceRaw>`
    //   SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   ORDER BY invoices.date DESC
    //   LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  noStore();
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.

    const invoiceCountPromise = prisma.invoice.count();
    // const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = prisma.customer.count();
    // const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = prisma.invoice.groupBy({
      by: ["status"],
      _sum: {
        amount: true,
      },
    });
    // const invoiceStatusPromise = sql`SELECT
    //      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
    //      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    //      FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0]);
    const numberOfCustomers = Number(data[1]);
    const totalPaidInvoices = formatCurrency(
      data[2].find((x) => x.status === "paid")?._sum.amount ?? 0
    );
    const totalPendingInvoices = formatCurrency(
      data[2].find((x) => x.status === "pending")?._sum.amount ?? 0
    );
    // const numberOfInvoices = Number(data[0].rows[0].count ?? "0");
    // const numberOfCustomers = Number(data[1].rows[0].count ?? "0");
    // const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? "0");
    // const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? "0");

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await prisma.$queryRaw`
    SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    ORDER BY invoices.date DESC
    LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;
    // const invoices = await sql<InvoicesTable>`
    // const invoices = await prisma.invoice.findMany({
    //   skip: offset,
    //   take: ITEMS_PER_PAGE,
    //   select: {
    //     id: true,
    //     amount: true,
    //     date: true,
    //     status: true,
    //     customer: {
    //       select: {
    //         name: true,
    //         imageUrl: true,
    //         email: true,
    //       },
    //     },
    //   },
    //   orderBy: {
    //     date: "desc",
    //   },
    //   where: {
    //     OR: [
    //       {
    //         amount: {
    //           // in: query.split(",").map(Number),
    //           equals: Number(query),
    //           // has: query,
    //           // contains: +query,
    //           // mode: "insensitive",
    //         },
    //       },
    //       {
    //         date: {
    //           // in: query.split(",").map(Date),
    //           equals: new Date(query),
    //         },
    //       },
    //       {
    //         status: {
    //           contains: query,
    //         },
    //       },
    //       {
    //         customer: {
    //           name: {
    //             contains: query,
    //             mode: "insensitive",
    //           },
    //           email: {
    //             contains: query,
    //             mode: "insensitive",
    //           },
    //         },
    //       },
    //     ],
    //   },
    // });

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

interface Count {
  count: number;
}

export async function fetchInvoicesPages(query: string): Promise<number> {
  noStore();
  try {
    const data: Count[] = await prisma.$queryRaw`
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
    `;
    //   const count = await sql`SELECT COUNT(*)
    // `;
    // const count = await prisma.invoice.aggregate({
    //   _count: {
    //     id: true,
    //   },
    //   where: {
    //     OR: [
    //       {
    //         amount: {
    //           // contains: query,
    //           // in: query.split(",").map(Number),
    //           equals: Number(query),
    //         },
    //       },
    //       {
    //         date: {
    //           equals: new Date(query),
    //         },
    //       },
    //       {
    //         status: {
    //           contains: query,
    //         },
    //       },
    //     ],
    //   },
    // });

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    // const data = await sql<InvoiceForm>`
    //   SELECT
    //     invoices.id,
    //     invoices.customer_id,
    //     invoices.amount,
    //     invoices.status
    //   FROM invoices
    //   WHERE invoices.id = ${id};
    // `;
    const data = await prisma.invoice.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        customerId: true,
        amount: true,
        status: true,
      },
    });
    if (!data) return;

    // const invoice = data.rows.map((invoice) => ({
    //   ...invoice,
    //   // Convert amount from cents to dollars
    //   amount: invoice.amount / 100,
    // }));
    const invoice = { ...data, amount: formatCurrency(data.amount) };

    return invoice;
  } catch (error) {
    console.error("Database Error:", error);
  }
}

export async function fetchCustomers() {
  noStore();
  try {
    // const data = await sql<CustomerField>`
    //   SELECT
    //     id,
    //     name
    //   FROM customers
    //   ORDER BY name ASC
    // `;
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export interface FilteredCustomer {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: string;
  total_paid: string;
}

export async function fetchFilteredCustomers(
  query: string
): Promise<FilteredCustomer[]> {
  try {
    const data: FilteredCustomer[] = await prisma.$queryRaw`
    SELECT
      customers.id,
      customers.name,
      customers.email,
      customers.image_url,
      COUNT(invoices.id) AS total_invoices,
      SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
      SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
    FROM customers
    LEFT JOIN invoices ON customers.id = invoices.customer_id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`}
    GROUP BY customers.id, customers.name, customers.email, customers.image_url
    ORDER BY customers.name ASC
    `;
    // const data = await prisma.customer.groupBy({
    //   by: ["id", "name", "email", "imageUrl"],
    //   _count: {
    //     id: true,
    //   },
    // invoice: {
    //   _sum: {
    //     amount: true,
    //   },
    // },
    // _sum: {
    //   amount: {
    //     where: {
    //       status: "pending",
    //     },
    //   },
    // },
    // total_invoices: {
    // },
    // total_pending: {
    // },
    // total_paid: {
    //   _sum: {
    //     amount: {
    //       where: {
    //         status: "paid",
    //       },
    //     },
    //   },
    // },
    //   where: {
    //     OR: [
    //       {
    //         name: {
    //           contains: query,
    //           mode: "insensitive",
    //         },
    //       },
    //       {
    //         email: {
    //           contains: query,
    //           mode: "insensitive",
    //         },
    //       },
    //     ],
    //   },
    //   orderBy: {
    //     name: "asc",
    //   },
    // });

    const customers = data.map((customer) => ({
      ...customer,
      total_invoices: Number(customer.total_invoices),
      total_pending: formatCurrency(Number(customer.total_pending)),
      total_paid: formatCurrency(Number(customer.total_paid)),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}

export async function getUser(email: string) {
  try {
    // const user = await sql`SELECT * from USERS where email=${email}`;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}
