import DropZone from "@/components/DropZone";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold pb-10">Uploading file using S3 📁</h1>
      <DropZone />
    </div>
  );
}
