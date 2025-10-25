import { z } from "zod";

const baseSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive."),
  date: z.date(),
});

const expenseSchema = baseSchema.extend({
  transactionType: z.literal("expense"),
  expenseType: z.enum(["mandatory", "optional"]).optional(),
  accountId: z.string({ required_error: "Account is required." }).min(1, "Account is required."),
  categoryId: z.string({ required_error: "Category is required." }).min(1, "Category is required."),
});

const incomeSchema = baseSchema.extend({
  transactionType: z.literal("income"),
  incomeType: z.enum(["active", "passive"]).optional(),
  accountId: z.string({ required_error: "Account is required." }).min(1, "Account is required."),
  categoryId: z.string({ required_error: "Category is required." }).min(1, "Category is required."),
});

const transferSchema = baseSchema.extend({
  transactionType: z.literal("transfer"),
  fromAccountId: z.string({ required_error: "Source account is required." }).min(1, "Source account is required."),
  toAccountId: z.string({ required_error: "Destination account is required." }).min(1, "Destination account is required."),
});

export const transactionFormSchema = z.discriminatedUnion("transactionType", [
  expenseSchema,
  incomeSchema,
  transferSchema,
]).refine(data => {
    if (data.transactionType === 'transfer') {
        return data.fromAccountId !== data.toAccountId;
    }
    return true;
}, {
    message: "Accounts must be different.",
    path: ["toAccountId"],
});


export const editTransactionFormSchema = z.discriminatedUnion("transactionType", [
  expenseSchema,
  incomeSchema,
  transferSchema,
]).refine(data => {
    if (data.transactionType === 'transfer') {
        return data.fromAccountId !== data.toAccountId;
    }
    return true;
}, {
    message: "Accounts must be different.",
    path: ["toAccountId"],
});

export const recurringTransactionFormSchema = z.object({
  description: z.string().min(1, "Description is required."),
  amount: z.coerce.number().positive("Amount must be positive."),
  accountId: z.string({ required_error: "Account is required." }).min(1, "Account is required."),
  categoryId: z.string({ required_error: "Category is required." }).min(1, "Category is required."),
  frequency: z.enum(["weekly", "bi-weekly", "monthly"]),
  startDate: z.date(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type EditTransactionFormValues = z.infer<typeof editTransactionFormSchema>;
export type RecurringTransactionFormValues = z.infer<typeof recurringTransactionFormSchema>;
