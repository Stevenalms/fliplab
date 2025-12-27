import { useState } from "react";
import { Upload, Music2, Loader, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpload } from "@/hooks/use-upload";

export default function DrumPackUploader() {
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: number; url: string }>>([]);
  const { uploadFile, isUploading, error, progress } = useUpload({
    onSuccess: (response) => {
      setUploadedFiles((prev) => [
        ...prev,
        {
          name: response.metadata.name,
          size: response.metadata.size,
          url: response.objectPath,
        },
      ]);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith("audio/") || file.name.endsWith(".zip"))) {
      await uploadFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4">
      <div className="container max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
            <Music2 className="w-10 h-10 text-primary" />
            UPLOAD DRUMS
          </h1>
          <p className="text-muted-foreground text-lg">
            Add your drum packs and samples to FlipLab. Upload .wav, .mp3, or .zip files.
          </p>
        </div>

        <Card className="p-8 bg-card/50 border-white/5 backdrop-blur-md mb-8">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <input
                type="file"
                accept="audio/*,.zip"
                onChange={handleFileChange}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div
                className={`w-32 h-32 rounded-xl border-2 border-dashed ${
                  isUploading ? "border-primary" : "border-white/20 hover:border-primary/50"
                } flex items-center justify-center transition-colors`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </div>
                ) : (
                  <Upload className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="text-center">
              <p className="font-bold">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground">WAV, MP3, or ZIP files</p>
            </div>

            {error && <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm w-full">{error.message}</div>}
          </div>
        </Card>

        {uploadedFiles.length > 0 && (
          <div className="bg-card/50 border border-white/5 rounded-xl p-8 backdrop-blur-md">
            <h2 className="text-2xl font-bold mb-6">Uploaded Files ({uploadedFiles.length})</h2>
            <div className="space-y-4">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-bold">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <code className="text-xs text-primary">{file.url}</code>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                Your drums are now uploaded! You can use them in matches or share the path with other players.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
