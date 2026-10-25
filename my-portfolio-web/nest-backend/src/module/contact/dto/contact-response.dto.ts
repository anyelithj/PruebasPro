// [SRP][ISP] shape de salida del envío de contacto
import { ContactSubmissionModel } from '../model/contact-submission.model';

export interface ContactResponseDto {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  category: string | null;
  priority: string | null;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toContactResponse = (submission: ContactSubmissionModel): ContactResponseDto => ({
  id: submission.id,
  name: submission.name,
  email: submission.email,
  message: submission.message,
  status: submission.status,
  category: submission.category,
  priority: submission.priority,
  ipAddress: submission.ipAddress,
  createdAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});
