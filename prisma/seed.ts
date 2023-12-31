import "dotenv/config";
import { Prisma, PrismaClient, Customer } from "@prisma/client";
import { users, customers, invoices, revenues } from "./placeholder-data";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const getUsers = (): Prisma.UserCreateInput[] => users;
const getCustomers = (): Prisma.CustomerCreateInput[] => customers;

const getInvoices = (customers: Customer[]): Prisma.InvoiceCreateInput[] =>
  invoices;

const getRevenue = (): Prisma.RevenueCreateInput[] => revenues;

const main = async () => {
  const users = await Promise.all(
    getUsers().map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return prisma.user.create({
        data: { ...user, password: hashedPassword },
      });
    })
  );
  const customers = await Promise.all(
    getCustomers().map((customer) => prisma.customer.create({ data: customer }))
  );
  const invoices = await Promise.all(
    getInvoices(customers).map((invoice) =>
      prisma.invoice.create({ data: invoice })
    )
  );
  const revenues = await Promise.all(
    getRevenue().map((revenue) => prisma.revenue.create({ data: revenue }))
  );
};

main();
