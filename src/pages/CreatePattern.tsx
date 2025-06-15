import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import PatternBuilder from "@/components/creator/PatternBuilder";
import type { CustomPattern } from "@/lib/ai/providers";
import { demoStoryIntegration } from "@/lib/story/storyClient";

const CreatePattern = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Check if we're editing an existing pattern
  const editPattern = location.state?.editPattern as CustomPattern | undefined;
  const isEditing = !!editPattern;

  const handleSave = async (pattern: CustomPattern) => {
    setIsSaving(true);

    try {
      // In production, this would be an API call
      console.log("Saving pattern:", pattern);

      // Mock save operation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Store in localStorage for demo purposes
      const storageKey = `pattern_${pattern.id}`;
      localStorage.setItem(storageKey, JSON.stringify(pattern));

      // Register as IP Asset on Story Protocol (demo)
      if (!isEditing) {
        try {
          const ipAssetId = await demoStoryIntegration.registerPatternDemo(
            pattern
          );
          pattern.ipAssetId = ipAssetId;
          pattern.storyProtocolRegistered = true;

          // Update stored pattern with IP info
          localStorage.setItem(storageKey, JSON.stringify(pattern));

          toast({
            title: "Pattern Created & IP Registered",
            description: `"${pattern.name}" has been saved and registered as IP Asset: ${ipAssetId}`,
          });
        } catch (error) {
          console.error("IP registration failed:", error);
          toast({
            title: "Pattern Created",
            description: `"${pattern.name}" has been saved successfully. IP registration failed.`,
          });
        }
      } else {
        toast({
          title: "Pattern Updated",
          description: `"${pattern.name}" has been updated successfully.`,
        });
      }

      // Navigate back to creator dashboard
      navigate("/creator");
    } catch (error) {
      console.error("Failed to save pattern:", error);
      toast({
        title: "Error",
        description: "Failed to save the pattern. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = (pattern: CustomPattern) => {
    // Navigate to breathing session with preview pattern
    navigate("/session", {
      state: {
        previewPattern: pattern,
        isPreview: true,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/creator")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditing ? "Edit Pattern" : "Create New Pattern"}
                </h1>
                <p className="text-muted-foreground">
                  {isEditing
                    ? `Editing "${editPattern.name}"`
                    : "Design a custom breathing pattern"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const currentPattern = editPattern || {
                    id: Date.now().toString(),
                    name: "Preview Pattern",
                    description: "Pattern preview",
                    phases: [],
                    category: "stress" as const,
                    difficulty: "beginner" as const,
                    duration: 0,
                    creator: "preview",
                  };
                  handlePreview(currentPattern);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Pattern Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PatternBuilder
                onSave={handleSave}
                existingPattern={editPattern}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tips Section */}
      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>💡 Pattern Creation Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">
                    Effective Breathing Patterns
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Start with simple ratios like 4:4:4 or 4:7:8</li>
                    <li>• Include pauses to allow natural breathing</li>
                    <li>• Test your pattern before publishing</li>
                    <li>• Consider your target audience's experience level</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Monetization</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Register IP to protect your unique patterns</li>
                    <li>• Set appropriate licensing terms</li>
                    <li>• Create clear, descriptive names</li>
                    <li>• Include detailed usage instructions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreatePattern;
