"use client";

import { cn, formatBytes } from "@/lib/utils";
import { File, FileImage, FileSpreadsheet, FileText, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/Card";

interface StateFile {
  id: string; // Unique identifier
  file: File; // The file
  uploading: boolean; // is the file currently being uploaded
  progress: number; // upload progress percentage
  key?: string; // the key of the file in the storage
  isDeleting: boolean; // is the file currently being deleted
  error: boolean; // has the file upload failed
  objectUrl?: string; // object url of the file
}

const DropZone = () => {
  const [files, setFiles] = useState<StateFile[]>([]);

  async function uploadFile(file: File) {
    setFiles((prevFiles) => [
      ...prevFiles.map((f) =>
        f.file === file ? { ...f, uploading: true } : f
      ),
    ]);

    try {
      console.log({ file });
      const data = await fetch("api/s3/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!data.ok) {
        toast.error("Failed to get presigned url");
        setFiles((prevFiles) => [
          ...prevFiles.map((f) =>
            f.file === file
              ? { ...f, uploading: false, error: true, progress: 0 }
              : f
          ),
        ]);
        return;
      }
      const { presignedUrl, key } = await data.json();

      console.log({ presignedUrl });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
          // Check if we have something uploading
          if (event.lengthComputable) {
            const percentageCompleted = (event.loaded / event.total) * 100;
            setFiles((prevFiles) => [
              ...prevFiles.map((f) =>
                f.file === file
                  ? { ...f, progress: Math.round(percentageCompleted), key }
                  : f
              ),
            ]);
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            setFiles((prevFiles) => [
              ...prevFiles.map((f) =>
                f.file === file
                  ? { ...f, progress: 100, uploading: false, error: false }
                  : f
              ),
            ]);

            toast.success("Files uploaded successfully!");
            resolve();
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Upload failed"));
        };

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-type", file.type);
        xhr.send(file);
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload your file");
      setFiles((prevFiles) => [
        ...prevFiles.map((f) =>
          f.file === file
            ? { ...f, uploading: false, error: true, progress: 0 }
            : f
        ),
      ]);
    }
  }

  async function removeFile(fileId: string) {
    try {
      const fileToRemove = files.find((f) => f.id === fileId);

      if (fileToRemove) {
        if (fileToRemove.objectUrl) {
          URL.revokeObjectURL(fileToRemove.objectUrl);
        }
      }

      setFiles((prevFiles) => [
        ...prevFiles.map((f) =>
          f.id === fileId ? { ...f, isDeleting: true } : f
        ),
      ]);

      const deletedFileResponse = await fetch("api/s3/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: fileToRemove?.key,
        }),
      });
      if (!deletedFileResponse.ok) {
        toast.error("Failed to delete file");
        setFiles((prevFiles) => [
          ...prevFiles.map((f) =>
            f.id === fileId ? { ...f, isDeleting: false, error: true } : f
          ),
        ]);
        return;
      }

      toast.success("File deleted successfully");

      setFiles((prevFiles) => [...prevFiles.filter((f) => f.id !== fileId)]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload your file");
      setFiles((prevFiles) => [
        ...prevFiles.map((f) =>
          f.id === fileId ? { ...f, isDeleting: false, error: true } : f
        ),
      ]);
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFiles((prevFiles) => [
        ...prevFiles,
        ...acceptedFiles.map((file) => ({
          id: uuidv4(),
          file: file,
          uploading: false,
          progress: 0,
          isDeleting: false,
          error: false,
          objectUrl: URL.createObjectURL(file),
        })),
      ]);
      acceptedFiles.forEach(uploadFile);
    }
    console.log({ acceptedFiles });
  }, []);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    let tooManyFilesShown = false;

    fileRejections.forEach(({ file, errors }) => {
      errors.forEach((error) => {
        if (error.code === "too-many-files") {
          if (!tooManyFilesShown) {
            toast.error("Too many files", {
              description: "You can only upload up to 5 files at a time.",
            });
            tooManyFilesShown = true;
          }
          return;
        }

        let title = "File rejected";
        let description = "An unknown error occurred";

        switch (error.code) {
          case "file-too-large":
            title = "File too large";
            description = `"${file.name}" exceeds the 5 MB limit.`;
            break;
          case "file-too-small":
            title = "File too small";
            description = `"${file.name}" is empty or too small.`;
            break;
          case "file-invalid-type":
            title = "Invalid file type";
            description = `"${file.name}" is not allowed. Only images, PDF, Word, Excel, TXT, and CSV files are accepted.`;
            break;
          default:
            description = error.message || `Error with "${file.name}"`;
        }

        toast.error(title, { description });
      });
    });

    console.log({ fileRejections });
  }, []);

  const getFileIcon = (file: File) => {
    const type = file.type;
    const name = file.name.toLowerCase();

    if (type.startsWith("image/"))
      return <FileImage className="w-8 h-8 text-blue-600" />;
    if (type === "application/pdf" || name.endsWith(".pdf"))
      return <FileText className="w-8 h-8 text-red-600" />;
    if (
      type.includes("word") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx")
    )
      return <FileText className="w-8 h-8 text-blue-700" />;
    if (
      type.includes("excel") ||
      type.includes("spreadsheet") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx")
    )
      return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
    if (name.endsWith(".txt"))
      return <FileText className="w-8 h-8 text-gray-700" />;
    if (name.endsWith(".csv"))
      return <FileSpreadsheet className="w-8 h-8 text-teal-600" />;

    return <File className="w-8 h-8 text-gray-500" />;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024, // 5 MB
    accept: {
      // Accept images
      "image/*": [],
      // Accept PDF
      "application/pdf": [".pdf"],
      // Accept MS word
      "application/msword": [".doc", ".dot"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx", ".dotx"],
      // Accept MS Excel
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
        ".xlsm",
        ".xltx",
        ".xltm",
      ],
      // Accept block note
      "text/plain": [".txt"],
      // Accept csv file
      "text/csv": [".csv"],
    },
  });

  return (
    <>
      <Card
        className={cn(
          "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-64 cursor-pointer hover:border-primary/50",
          isDragActive && "border-primary bg-primary/10"
        )}
        {...getRootProps()}
      >
        <CardContent className="flex flex-col justify-center items-center h-full w-full text-center">
          <input disabled={files.length >= 5} {...getInputProps()} />
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the files here...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-lg">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                Images, PDF, Word, Excel, TXT, CSV • Max 5 files • 5 MB each
              </p>
              <Button
                variant="outline"
                className={cn({
                  "cursor-pointer": files.length < 5,
                  "cursor-not-allowed": files.length >= 5,
                })}
              >
                Select files
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {files.length > 0 && (
        <div className="mt-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {files.map((item) => (
              <div
                key={item.id}
                className="group relative bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200"
              >
                {/* Aperçu ou icône */}
                <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                  {item.file.type.startsWith("image/") ? (
                    <Image
                      src={item.objectUrl!}
                      alt={item.file.name}
                      width={200}
                      height={200}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="p-6">{getFileIcon(item.file)}</div>
                  )}

                  {/* Overlay pendant upload / suppression */}
                  {(item.uploading || item.isDeleting) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-white">
                        {item.uploading && (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="text-sm">{item.progress}%</span>
                          </div>
                        )}
                        {item.isDeleting && (
                          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(item.id);
                    }}
                    disabled={item.uploading || item.isDeleting}
                    className={cn(
                      "absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur-sm transition-all cursor-pointer",
                      "opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-white",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Infos fichier */}
                <div className="p-3 space-y-1">
                  <p
                    className="text-sm font-medium truncate"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                  </p>

                  {/* Barre de progression */}
                  {item.uploading && item.progress < 100 && (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Statut succès / erreur */}
                  {item.progress === 100 && !item.error && (
                    <p className="text-xs text-green-600 font-medium">
                      Uploaded
                    </p>
                  )}
                  {item.error && (
                    <p className="text-xs text-destructive font-medium">
                      Failed
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DropZone;
