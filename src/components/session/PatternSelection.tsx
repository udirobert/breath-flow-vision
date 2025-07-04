import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Clock, Users, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BREATHING_PATTERNS } from "@/lib/breathingPatterns";
import type { CustomPattern } from "@/lib/ai/providers";

interface PatternSelectionProps {
  userLibrary: CustomPattern[];
  onPatternSelect: (pattern: CustomPattern | null) => void;
  onCreateNew: () => void;
}

interface PatternWithStats extends CustomPattern {
  rating?: number;
  usageCount?: number;
  lastUsed?: string;
  featured?: boolean;
}

// Convert built-in patterns to CustomPattern format
const getBuiltInPatterns = (): PatternWithStats[] => {
  return Object.values(BREATHING_PATTERNS).map((pattern) => ({
    id: pattern.key,
    name: pattern.name,
    description: `A ${pattern.name.toLowerCase()} breathing pattern with ${pattern.cycles === Infinity ? "continuous" : pattern.cycles} cycles.`,
    phases: pattern.phases,
    category: "stress" as const,
    difficulty: "beginner" as const,
    duration:
      pattern.phases.reduce((sum, phase) => sum + phase.duration, 0) / 1000,
    creator: "Built-in",
    rating: 4.5 + Math.random() * 0.5,
    usageCount: Math.floor(Math.random() * 1000),
    featured: pattern.key === "box" || pattern.key === "wimHof",
  }));
};

export const PatternSelection: React.FC<PatternSelectionProps> = ({
  userLibrary,
  onPatternSelect,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [builtInPatterns] = useState<PatternWithStats[]>(getBuiltInPatterns());
  const [allPatterns, setAllPatterns] = useState<PatternWithStats[]>([]);
  const [filteredPatterns, setFilteredPatterns] = useState<PatternWithStats[]>(
    [],
  );
  const navigate = useNavigate();

  useEffect(() => {
    // Combine built-in patterns with user library
    const combined = [
      ...builtInPatterns,
      ...userLibrary.map((pattern) => ({
        ...pattern,
        rating: 4.0 + Math.random(),
        usageCount: Math.floor(Math.random() * 100),
        lastUsed: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })),
    ];
    setAllPatterns(combined);
  }, [builtInPatterns, userLibrary]);

  useEffect(() => {
    let filtered = [...allPatterns];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (pattern) =>
          pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pattern.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (pattern) => pattern.category === selectedCategory,
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return (b.usageCount || 0) - (a.usageCount || 0);
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "recent":
          return (
            new Date(b.lastUsed || 0).getTime() -
            new Date(a.lastUsed || 0).getTime()
          );
        case "alphabetical":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredPatterns(filtered);
  }, [allPatterns, searchQuery, selectedCategory, sortBy]);

  const handlePatternSelect = (pattern: PatternWithStats) => {
    // Convert back to the format expected by the breathing session
    const sessionPattern = {
      key: pattern.id,
      name: pattern.name,
      phases: pattern.phases,
      cycles: 5, // Default cycles
      hasBreathHold: false,
    };

    // Store the selected pattern and navigate to session
    localStorage.setItem("selectedPattern", JSON.stringify(sessionPattern));
    onPatternSelect(pattern);
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const PatternCard = ({ pattern }: { pattern: PatternWithStats }) => (
    <Card
      className={`h-full transition-all hover:shadow-lg cursor-pointer ${pattern.featured ? "ring-2 ring-blue-500" : ""}`}
      onClick={() => handlePatternSelect(pattern)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">
              {pattern.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              by {pattern.creator}
            </p>
          </div>
          {pattern.featured && (
            <Badge variant="secondary" className="text-xs">
              Featured
            </Badge>
          )}
        </div>

        {pattern.rating && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{pattern.rating.toFixed(1)}</span>
            </div>
            {pattern.usageCount && (
              <div className="flex items-center gap-1 ml-auto">
                <Users className="h-4 w-4" />
                <span>{pattern.usageCount}</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {pattern.description}
        </p>

        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {pattern.category}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {pattern.difficulty}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(pattern.duration)}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {pattern.phases.length} phases •{" "}
          {pattern.lastUsed
            ? `Last used ${new Date(pattern.lastUsed).toLocaleDateString()}`
            : "Never used"}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Choose Your Breathing Pattern
        </h1>
        <p className="text-muted-foreground">
          Select from our curated collection or your personal library
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onCreateNew}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New
          </Button>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="stress">Stress Relief</SelectItem>
              <SelectItem value="sleep">Sleep</SelectItem>
              <SelectItem value="focus">Focus</SelectItem>
              <SelectItem value="energy">Energy</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="recent">Recently Used</SelectItem>
              <SelectItem value="alphabetical">A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Featured Patterns */}
      {filteredPatterns.some((p) => p.featured) && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Featured Patterns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatterns
              .filter((p) => p.featured)
              .map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
          </div>
        </div>
      )}

      {/* Pattern Library */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All Patterns ({filteredPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="built-in">
            Built-in ({builtInPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="my-library">
            My Library ({userLibrary.length})
          </TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPatterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="built-in" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPatterns
              .filter((p) => p.creator === "Built-in")
              .map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="my-library" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPatterns
              .filter((p) => p.creator !== "Built-in")
              .map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
          </div>
          {userLibrary.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No patterns in your library yet.
              </p>
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Pattern
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPatterns
              .filter((p) => p.lastUsed)
              .sort(
                (a, b) =>
                  new Date(b.lastUsed!).getTime() -
                  new Date(a.lastUsed!).getTime(),
              )
              .slice(0, 8)
              .map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="favorites" className="mt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Favorites feature coming soon!
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {filteredPatterns.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No patterns found matching your criteria.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Quick Start Options */}
      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-16"
            onClick={() =>
              handlePatternSelect(builtInPatterns.find((p) => p.id === "box")!)
            }
          >
            <div className="text-center">
              <div className="font-semibold">Box Breathing</div>
              <div className="text-xs text-muted-foreground">
                Classic 4-4-4-4 pattern
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-16"
            onClick={() =>
              handlePatternSelect(builtInPatterns.find((p) => p.id === "calm")!)
            }
          >
            <div className="text-center">
              <div className="font-semibold">Calm Breathing</div>
              <div className="text-xs text-muted-foreground">
                Gentle relaxation
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-16"
            onClick={() => navigate("/marketplace")}
          >
            <div className="text-center">
              <div className="font-semibold">Explore Marketplace</div>
              <div className="text-xs text-muted-foreground">
                Discover new patterns
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};
