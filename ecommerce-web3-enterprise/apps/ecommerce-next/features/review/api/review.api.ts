// review.api.ts => reseñas: lecturas REST (Axios) con cache de TanStack Query y publicación por GraphQL
// (Mutation "createReview" con Apollo Client). Tras publicar se invalida la cache REST (lista + resumen).
"use client";

import { gql, type TypedDocumentNode } from "@apollo/client";
import { useMutation as useGraphqlMutation } from "@apollo/client/react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiRequest, type ApiError } from "@/shared/lib/api-client";
import { queryKeys, toApiErrorFromGraphql } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import type { PaginationMeta } from "@/shared/types/api.types";
import type { ReviewFormValues } from "../lib/review.validator";

export interface Review {
  id: string;
  productId: string;
  productName: string;
  author: { id: string; name: string; avatarUrl: string | null };
  rating: number;
  title: string;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isVerifiedPurchase: boolean;
  vendorReply: string | null;
  editableUntil: string;
  createdAt: string;
}

export interface ReviewSummaryData {
  productId: string;
  average: number;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

interface ReviewQuery {
  productId?: string;
  rating?: number;
  mine?: boolean;
  page?: number;
}

// useReviews => listado paginado; "keepPreviousData" mantiene la página anterior visible mientras llega la nueva (sin parpadeo)
export function useReviews(params: ReviewQuery) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.reviews(params),
    queryFn: () =>
      apiRequest<Review[]>("/review", {
        token: accessToken,
        query: { productId: params.productId, rating: params.rating, mine: params.mine ? "true" : undefined, page: params.page ?? 1, limit: 10 },
      }) as Promise<{ data: Review[]; meta?: PaginationMeta }>,
    placeholderData: keepPreviousData,
    enabled: !params.mine || Boolean(accessToken),
  });
}

export function useReviewSummary(productId: string) {
  return useQuery({ queryKey: queryKeys.reviewSummary(productId), queryFn: () => apiGet<ReviewSummaryData>("/review/summary", { query: { productId } }) });
}

// CREATE_REVIEW => Mutation GraphQL; "status" decide el mensaje (publicada o en moderación)
const CREATE_REVIEW: TypedDocumentNode<{ createReview: Pick<Review, "id" | "status"> }, { input: ReviewFormValues & { productId: string } }> = gql`
  mutation CreateReview($input: CreateReviewInput!) {
    createReview(input: $input) { id status }
  }
`;

interface MutateHandlers {
  onSuccess?: (review: Pick<Review, "id" | "status">) => void;
  onError?: (error: ApiError) => void;
}

// useCreateReview => publica por GraphQL y refresca lista + resumen del producto.
// Expone "mutate(values, { onSuccess, onError })" e "isPending", la misma forma que los demás hooks (Adapter)
export function useCreateReview(productId: string) {
  const queryClient = useQueryClient();
  // "useGraphqlMutation" => hook de Apollo; "loading" indica que la Mutation está en curso
  const [createReview, { loading }] = useGraphqlMutation(CREATE_REVIEW);
  const mutate = (values: ReviewFormValues, handlers: MutateHandlers = {}) =>
    createReview({ variables: { input: { ...values, productId } } })
      .then(({ data }) => {
        void queryClient.invalidateQueries({ queryKey: ["reviews"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.reviewSummary(productId) });
        if (data) handlers.onSuccess?.(data.createReview);
      })
      // Errores GraphQL -> ApiError: la UI muestra el mismo mensaje traducido que con REST
      .catch((error: unknown) => handlers.onError?.(toApiErrorFromGraphql(error)));
  return { mutate, isPending: loading };
}

// useUpdateReview / useDeleteReview => edición y borrado desde "Mis reseñas"
export function useUpdateReview() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReviewFormValues }) => apiRequest<Review>(`/review/${id}`, { method: "PATCH", token: accessToken, body: values }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useDeleteReview() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/review/${id}`, { method: "DELETE", token: accessToken }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });
}
