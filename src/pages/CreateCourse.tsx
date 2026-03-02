import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCourse } from "../services/courses";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

export default function CreateCourse() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(Schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await insertCourse({ title: values.title, description: values.description ?? null });
      toast.success("Course created");
      reset();
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to create course");
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Create Course</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Course title"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            placeholder="Optional description"
            rows={4}
            {...register("description")}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
