"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useVoiceStore } from "@/store/use-voice-store";
import { Voice } from "@/lib/types";
import Image from "next/image";

// Featured voices data
interface FeaturedVoice {
  id: number;
  name: string;
  imagePath: string;
  language: string;
  gender: string;
}

export default function VoiceLibraryPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredVoices, setFilteredVoices] = useState<Voice[]>([]);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
    const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const featuredItemsRef = useRef<(HTMLDivElement | null)[]>([]);
    
    const { voices, fetchVoices, isLoading, error } = useVoiceStore();
    
    // Featured voices array
    const featuredVoices: FeaturedVoice[] = [
        {
            id: 1,
            name: "Riya-Rao-English-Indian",
            imagePath: "/voicelibrary-featured-images/Indian-women.png",
            language: "English",
            gender: "Women"
        },
        {
            id: 2,
            name: "Aaron-English",
            imagePath: "/voicelibrary-featured-images/Indian-men.png",
            language: "English",
            gender: "Men"
        },
        {
            id: 3,
            name: "Monika-English-Indian",
            imagePath: "/voicelibrary-featured-images/Indian-women2.png",
            language: "English",
            gender: "Women"
        },
        {
            id: 4,
            name: "Rosa-Portuguese",
            imagePath: "/voicelibrary-featured-images/portuguese-women.png",
            language: "Portuguese",
            gender: "Women"
        },
        {
            id: 5,
            name: "Frida - German",
            imagePath: "/voicelibrary-featured-images/German-women.png",
            language: "German",
            gender: "Women"
        },
        {
            id: 6,
            name: "Victor-Spanish",
            imagePath: "/voicelibrary-featured-images/spanish-men.png",
            language: "Spanish",
            gender: "Men"
        },
        {
            id: 7,
            name: "Hugo-French",
            imagePath: "/voicelibrary-featured-images/French-men.png",
            language: "French",
            gender: "Men"
        }
    ];

    useEffect(() => {
        fetchVoices();
    }, [fetchVoices]);
    
    useEffect(() => {
        if (voices && voices.length > 0) {
            setFilteredVoices(
                voices.filter(voice => 
                    voice.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
            );
        }
    }, [voices, searchQuery]);

    const findPreviewUrlByName = (name: string): string | null => {
        const matchedVoice = voices?.find(voice => 
            voice.name.toLowerCase().includes(name.toLowerCase())
        );
        return matchedVoice?.previewUrl || null;
    };
    
    const handlePlay = (voiceId: string, previewUrl: string) => {
        if (!previewUrl) return;
        
        if (currentlyPlaying === voiceId) {
            // Stop playing if the same voice is clicked again
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setCurrentlyPlaying(null);
        } else {
            // Play a new voice
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            
            const audio = new Audio(previewUrl);
            audio.onended = () => setCurrentlyPlaying(null);
            audio.play();
            audioRef.current = audio;
            setCurrentlyPlaying(voiceId);
        }
    };

    const handlePlayFeatured = (featuredVoice: FeaturedVoice) => {
        const previewUrl = findPreviewUrlByName(featuredVoice.name);
        if (!previewUrl) return;
        
        const matchedVoice = voices?.find(voice => 
            voice.name.toLowerCase().includes(featuredVoice.name.toLowerCase())
        );
        
        if (!matchedVoice) return;
        
        handlePlay(matchedVoice.voiceId, previewUrl);
    };
    
    const scrollToIndex = (index: number) => {
        const container = scrollerRef.current;
        const item = featuredItemsRef.current[index];

        if (container && item) {
            // Calculate the scroll position to center the item
            const containerWidth = container.clientWidth;
            const itemWidth = item.offsetWidth;
            const scrollLeft = item.offsetLeft - (containerWidth / 2) + (itemWidth / 2);

            container.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    };

    const handlePrevFeatured = () => {
        const newIndex = currentFeaturedIndex === 0 ? featuredVoices.length - 1 : currentFeaturedIndex - 1;
        setCurrentFeaturedIndex(newIndex);
        scrollToIndex(newIndex);
    };
    
    const handleNextFeatured = () => {
        const newIndex = currentFeaturedIndex === featuredVoices.length - 1 ? 0 : currentFeaturedIndex + 1;
        setCurrentFeaturedIndex(newIndex);
        scrollToIndex(newIndex);
    };

    // Effect to scroll to the initial featured item
    useEffect(() => {
        if (featuredVoices.length > 0) {
            scrollToIndex(currentFeaturedIndex);
        }
    }, []);

    const isFeaturedPlaying = (featuredVoice: FeaturedVoice): boolean => {
        if (!currentlyPlaying) return false;
        
        const matchedVoice = voices?.find(voice => 
            voice.name.toLowerCase().includes(featuredVoice.name.toLowerCase()) && 
            voice.voiceId === currentlyPlaying
        );
        
        return !!matchedVoice;
    };
    
    return (
      <div className="relative min-h-screen bg-background">
        {/* Featured Voices Section (Fixed) */}
        <div className="sticky top-0 z-10 bg-background pt-6 pb-4 px-6 md:px-8 border-b">
          <div className="">
            <h2 className="text-xl font-semibold">Top Picks For You</h2>

            <div className="relative">
              <div
                className="flex overflow-x-auto gap-4 p-4 hide-scrollbar"
                ref={scrollerRef}
              >
                {featuredVoices.map((featuredVoice, index) => (
                  <div
                    key={featuredVoice.id}
                    ref={(el) => (featuredItemsRef.current[index] = el)}
                    className={`relative flex-shrink-0 w-[250px] h-[150px] rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                      index === currentFeaturedIndex
                        ? "border-primary scale-105"
                        : "border-transparent"
                    } hover:border-primary/70 hover:shadow-md`}
                    onClick={() => {
                      setCurrentFeaturedIndex(index);
                      scrollToIndex(index);
                    }}
                  >
                    <Image
                      src={featuredVoice.imagePath}
                      alt={featuredVoice.name}
                      fill
                      className="object-cover opacity-60"
                    />
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-white drop-shadow-md">
                          {featuredVoice.name}
                        </h3>
                        <p className="text-sm text-white/90 drop-shadow-md">
                          {featuredVoice.language}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-fit self-start flex items-center gap-1"
                        onClick={() => handlePlayFeatured(featuredVoice)}
                        disabled={!findPreviewUrlByName(featuredVoice.name)}
                      >
                        <Icon
                          name={
                            isFeaturedPlaying(featuredVoice)
                              ? "pauseCircle"
                              : "playCircle"
                          }
                          className="h-4 w-4"
                        />
                        <span>
                          {isFeaturedPlaying(featuredVoice) ? "Pause" : "Play"}
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Arrows */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full shadow-md z-10"
                onClick={handlePrevFeatured}
              >
                <Icon name="chevronLeft" className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full shadow-md z-10"
                onClick={handleNextFeatured}
              >
                <Icon name="chevronRight" className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-start">
            <div className="relative w-full md:w-64">
              <Input
                placeholder="Search voices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 border-muted-foreground/50 "
              />
              <Icon
                name="mic"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Voice Library Content (Scrollable) */}
        <div className="px-6 md:px-12 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Icon
                name="loader-2"
                className="h-8 w-8 animate-spin text-primary"
              />
              <span className="ml-2">Loading voices...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-500">
              <Icon name="alert-circle" className="h-6 w-6 mr-2" />
              <span>Error loading voices: {error}</span>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {searchQuery ? (
                <span>No voices found matching "{searchQuery}"</span>
              ) : (
                <span>No voices available</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredVoices
                .filter((voice) => voice.previewUrl)
                .map((voice) => (
                  <Card
                    key={voice.voiceId}
                    className="px-6 py-4 hover:shadow-lg transition-all duration-300 border border-muted-foreground/10 hover:border-primary/20"
                  >
                    <div className="flex flex-col space-y-6">
                      <h3
                        className="font-medium text-lg truncate"
                        title={voice.name}
                      >
                        {voice.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <Button
                          variant={
                            currentlyPlaying === voice.voiceId
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() =>
                            handlePlay(voice.voiceId, voice.previewUrl!)
                          }
                          className="flex items-center space-x-1"
                        >
                          <Icon
                            name={
                              currentlyPlaying === voice.voiceId
                                ? "pauseCircle"
                                : "playCircle"
                            }
                            className="h-4 w-4"
                          />
                          <span>
                            {currentlyPlaying === voice.voiceId
                              ? "Pause"
                              : "Play"}
                          </span>
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          ID: {voice.voiceId.slice(0, 6)}...
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>

        {/* Add custom styling for hiding scrollbar */}
        <style jsx global>{`
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    );
}