import { z } from "zod";

const baseSchema = z.object({
  description: z.string().optional(),
  date: z.date(),
});

const expenseSchema = baseSchema.extend({
  transactionType: z.literal("expense"),
  amount: z.coerce.number().positive("Amount must be positive."),
  expenseType: z.enum(["mandatory", "optional"]).optional(),
  accountId: z.string({ required_error: "Account is required." }).min(1, "Account is required."),
  categoryId: z.string({ required_error: "Category is required." }).min(1, "Category is required."),
});

const incomeSchema = baseSchema.extend({
  transactionType: z.literal("income"),
  amount: z.coerce.number().positive("Amount must be positive."),
  incomeType: z.enum(["active", "passive"]).optional(),
  accountId: z.string({ required_error: "Account is required." }).min(1, "Account is required."),
  categoryId: z.string({ required_error: "Category is required." }).min(1, "Category is required."),
});

const transferSchema = baseSchema.extend({
  transactionType: z.literal("transfer"),
  fromAccountId: z.string({ required_error: "Source account is required." }).min(1, "Source account is required."),
  toAccountId: z.string({ required_error: "Destination account is required." }).min(1, "Destination account is required."),
  amount: z.coerce.number().positive("Amount must be positive.").optional(),
  amountSent: z.coerce.number().positive("Amount sent must be positive.").optional(),
  amountReceived: z.coerce.number().positive("Amount received must be positive.").optional(),
});

const multiCurrencyTransferRefinement = {
    message: "Both sent and received amounts are required for multi-currency transfers.",
    path: ["amountSent"],
};

const singleCurrencyTransferRefinement = {
    message: "Amount is required for transfers between accounts of the same currency.",
    path: ["amount"],
};

export const transactionFormSchema = z.discriminatedUnion("transactionType", [
  expenseSchema,
  incomeSchema,
  transferSchema,
]).superRefine((data, ctx) => {
    if (data.transactionType === 'transfer') {
        if (data.fromAccountId === data.toAccountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Accounts must be different.",
                path: ["toAccountId"],
            });
        }
    }
});


export const editTransactionFormSchema = z.discriminatedUnion("transactionType", [
  expenseSchema,
  incomeSchema,
  transferSchema,
]).superRefine((data, ctx) => {
    if (data.transactionType === 'transfer') {
        if (data.fromAccountId === data.toAccountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Accounts must be different.",
                path: ["toAccountId"],
            });
        }
    }
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
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type EditTransactionFormValues = z.infer<typeof editTransactionFormSchema>;
export type EditTransactionFormInput = z.input<typeof editTransactionFormSchema>;
export type RecurringTransactionFormValues = z.infer<typeof recurringTransactionFormSchema>;
