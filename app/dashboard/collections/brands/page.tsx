"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, ArrowUpDown, Building2, TrendingUp, Package, Filter, Star, Users, Eye, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// Brand Logo Component with fallback
const BrandLogo = ({ 
  brandName, 
  logoUrl, 
  size = "h-10 w-10", 
  className = "",
  textSize = "text-sm"
}: { 
  brandName: string; 
  logoUrl?: string; 
  size?: string; 
  className?: string;
  textSize?: string;
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);

  // Multiple logo sources for better fallback
  const getLogoSources = (brandName: string) => {
    const cleanName = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const brandDomains: { [key: string]: string } = {
      'apple': 'apple.com',
      'samsung': 'samsung.com',
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'amazon': 'amazon.com',
      'sony': 'sony.com',
      'lg': 'lg.com',
      'hp': 'hp.com',
      'dell': 'dell.com',
      'lenovo': 'lenovo.com',
      'asus': 'asus.com',
      'acer': 'acer.com',
      'huawei': 'huawei.com',
      'xiaomi': 'mi.com',
      'oneplus': 'oneplus.com',
      'nokia': 'nokia.com',
      'motorola': 'motorola.com',
      'oppo': 'oppo.com',
      'vivo': 'vivo.com',
      'realme': 'realme.com',
      'nothing': 'nothing.tech',
      'fairphone': 'fairphone.com',
      'tcl': 'tcl.com',
      'honor': 'hihonor.com',
      'blackberry': 'blackberry.com'
    };
    
    const domain = brandDomains[cleanName] || `${cleanName}.com`;
    
    return [
      `https://logo.clearbit.com/${domain}`,
      `https://img.logo.dev/${domain}?token=pk_-LogoDevAPIKey-`, // Would need real API key
      `https://logo.uplead.com/${domain}`,
    ];
  };

  const logoSources = getLogoSources(brandName);
  const currentLogoUrl = logoUrl || logoSources[currentLogoIndex];

  const handleImageError = () => {
    // Try next logo source
    if (currentLogoIndex < logoSources.length - 1) {
      setCurrentLogoIndex(prev => prev + 1);
      setImageLoaded(false);
    } else {
      setImageError(true);
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Reset when brandName changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setCurrentLogoIndex(0);
  }, [brandName]);

  if (imageError && currentLogoIndex >= logoSources.length - 1) {
    // Fallback to initials after all sources fail
    return (
      <div className={`${size} border border-primary/20 group-hover:border-primary/40 transition-all duration-300 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 flex items-center justify-center group-hover:scale-110 ${className}`}>
        <span className={`text-primary font-bold ${textSize} group-hover:text-primary transition-colors`}>
          {brandName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={`${size} border border-primary/20 group-hover:border-primary/40 transition-all duration-300 rounded-lg bg-white group-hover:scale-110 flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src={currentLogoUrl}
        alt={`${brandName} logo`}
        className={`w-full h-full object-contain p-1 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      {!imageLoaded && !imageError && (
        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <span className={`text-primary font-bold ${textSize}`}>
            {brandName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};

// Trending Brand Logo Component with orange theme
const TrendingBrandLogo = ({ 
  brandName, 
  logoUrl, 
  size = "h-10 w-10", 
  className = "",
  textSize = "text-sm"
}: { 
  brandName: string; 
  logoUrl?: string; 
  size?: string; 
  className?: string;
  textSize?: string;
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Reset error state when logoUrl changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [logoUrl]);

  if (!logoUrl || imageError) {
    // Fallback to initials with orange theme
    return (
      <div className={`${size} bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-orange-200/50 group-hover:border-orange-300/70 transition-all duration-300 group-hover:scale-110 ${className}`}>
        <span className={`${textSize} font-bold text-orange-600 group-hover:text-orange-700 transition-colors`}>
          {brandName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={`${size} border border-orange-200/50 group-hover:border-orange-300/70 transition-all duration-300 rounded-lg bg-white group-hover:scale-110 flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src={logoUrl}
        alt={`${brandName} logo`}
        className={`w-full h-full object-contain p-1 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      {!imageLoaded && !imageError && (
        <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
          <span className={`text-orange-600 font-bold ${textSize}`}>
            {brandName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};

interface Brand {
  id: number;
  title: string;
  description: string;
  category: string;
  logoUrl?: string;
}

interface TopVisited {
  metadata: string;
  count: number;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [topVisited, setTopVisited] = useState<TopVisited[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  
  // Lazy loading states
  const [displayedBrands, setDisplayedBrands] = useState<Brand[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const itemsPerLoad = 20;
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCollection = searchParams.get('collection');

  // Function to get brand logo URL
  const getBrandLogoUrl = (brandName: string) => {
    // Clean brand name for logo lookup
    const cleanName = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Map of common brand names to their domains for better logo fetching
    const brandDomains: { [key: string]: string } = {
      'apple': 'apple.com',
      'samsung': 'samsung.com',
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'amazon': 'amazon.com',
      'sony': 'sony.com',
      'lg': 'lg.com',
      'hp': 'hp.com',
      'dell': 'dell.com',
      'lenovo': 'lenovo.com',
      'asus': 'asus.com',
      'acer': 'acer.com',
      'huawei': 'huawei.com',
      'xiaomi': 'mi.com',
      'oneplus': 'oneplus.com',
      'nokia': 'nokia.com',
      'motorola': 'motorola.com',
      'oppo': 'oppo.com',
      'vivo': 'vivo.com',
      'realme': 'realme.com',
      'nothing': 'nothing.tech',
      'fairphone': 'fairphone.com',
      'tcl': 'tcl.com',
      'honor': 'hihonor.com',
      'blackberry': 'blackberry.com'
    };
    
    // Get the appropriate domain
    const domain = brandDomains[cleanName] || `${cleanName}.com`;
    
    // Use Clearbit logo service (most reliable for company logos)
    return `https://logo.clearbit.com/${domain}`;
  };

  // Function to track UI events
  const trackEvent = async (type: string, metadata: string) => {
    try {
      await fetch('/api/ui-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          metadata,
          url: window.location.pathname,
        }),
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  // Handle browse button click
  const handleBrowseClick = (brandTitle: string) => {
    trackEvent('click', brandTitle);
    // Navigate to products page with both collection and brand parameters
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('brand', brandTitle);
    router.push(`/dashboard/collections/brands/products?${currentParams.toString()}`);
  };

  // Redirect to collections if no collection is selected
  useEffect(() => {
    if (!loading && !selectedCollection) {
      router.push('/dashboard/collections');
      return;
    }
  }, [selectedCollection, router, loading]);

  // Don't render if no collection is selected
  if (!selectedCollection) {
    return null;
  }

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch brands from our API route
        const response = await fetch('/api/brands');
        if (!response.ok) {
          throw new Error('Failed to fetch brands');
        }
        
        const data = await response.json();
        const productVendors = data.productVendors || [];
        
        // Transform product vendors into brands format with consistent title casing
        const transformedBrands = productVendors.map((productVendor: { node: string }, index: number) => {
          const brandTitle = productVendor.node
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          return {
            id: index + 1,
            title: brandTitle,
            description: `Browse ${productVendor.node.toLowerCase()} products`,
            category: productVendor.node,
            logoUrl: getBrandLogoUrl(brandTitle)
          };
        });

        setBrands(transformedBrands);

        // Fetch top visited items for this specific page
        const topVisitedResponse = await fetch(`/api/top-visited?url=${encodeURIComponent('/dashboard/collections/brands')}`);
        if (topVisitedResponse.ok) {
          const topVisitedData = await topVisitedResponse.json();
          setTopVisited(topVisitedData.topVisited || []);
        }
      } catch (error) {
        console.error('Error loading brands:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter and sort brands
  const filteredAndSortedBrands = useMemo(() => {
    let filtered = brands.filter(brand =>
      brand.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort brands
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "popular":
          // Sort by popularity (check if brand is in topVisited)
          const aPopular = topVisited.some(item => item.metadata.toLowerCase() === a.title.toLowerCase());
          const bPopular = topVisited.some(item => item.metadata.toLowerCase() === b.title.toLowerCase());
          if (aPopular && !bPopular) return -1;
          if (!aPopular && bPopular) return 1;
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [brands, searchTerm, sortBy, topVisited]);

  // Initialize displayed brands when filtered brands change
  useEffect(() => {
    const initialBrands = filteredAndSortedBrands.slice(0, itemsPerLoad);
    setDisplayedBrands(initialBrands);
    setHasMore(filteredAndSortedBrands.length > itemsPerLoad);
  }, [filteredAndSortedBrands, itemsPerLoad]);

  // Load more brands function
  const loadMoreBrands = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    
    // Simulate loading delay for better UX
    setTimeout(() => {
      const currentLength = displayedBrands.length;
      const nextBrands = filteredAndSortedBrands.slice(currentLength, currentLength + itemsPerLoad);
      
      setDisplayedBrands(prev => [...prev, ...nextBrands]);
      setHasMore(currentLength + nextBrands.length < filteredAndSortedBrands.length);
      setIsLoadingMore(false);
    }, 300);
  }, [displayedBrands.length, filteredAndSortedBrands, itemsPerLoad, isLoadingMore, hasMore]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreBrands();
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = document.getElementById('load-more-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [hasMore, isLoadingMore, loadMoreBrands]);

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">
                      Dashboard
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Brands</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="text-center py-20">
              <Card className="max-w-md mx-auto border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-12">
                  <div className="space-y-6">
                    <div className="relative mx-auto w-16 h-16">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-lg"></div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-primary">Loading brands...</h3>
                      <p className="text-sm text-muted-foreground">
                        Discovering amazing products for you
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Brands</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Header Section with improved styling */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Product Brands
                </h1>
                <p className="text-muted-foreground text-sm flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  Discover brands for {selectedCollection} • {brands.length} brands available
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Search and filter section */}
          <Card className="border border-muted/50 bg-gradient-to-r from-background to-muted/20">
            <CardContent className="p-3">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search brands by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border focus:border-primary/50 transition-colors"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
                      onClick={() => setSearchTerm("")}
                    >
                      ×
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full lg:w-36 h-9 border text-sm">
                      <ArrowUpDown className="h-3 w-3 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9 px-3 border">
                    <Filter className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Results info with enhanced styling */}
              <div className="mt-2 pt-2 border-t border-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Showing <span className="font-semibold text-foreground">{displayedBrands.length}</span> of <span className="font-semibold text-foreground">{filteredAndSortedBrands.length}</span> brands
                    {filteredAndSortedBrands.length !== brands.length && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {brands.length} total
                      </span>
                    )}
                  </p>
                  {searchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Filtered results
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Most Popular Brands Section */}
          {topVisited.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <span className="text-xl">🔥</span>
                    Trending Brands
                  </h2>
                  <p className="text-xs text-muted-foreground">Most clicked brands this week</p>
                </div>
              </div>
              
              <Card className="border border-orange-200/50 bg-gradient-to-br from-orange-50/50 to-red-50/30 dark:from-orange-950/20 dark:to-red-950/20 shadow-sm">
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {topVisited.map((item, index) => (
                      <Card
                        key={`${item.metadata}-${index}`}
                        className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-orange-300/50 bg-background/90 backdrop-blur-sm border hover:scale-[1.02] relative overflow-hidden aspect-[4/3]"
                        onClick={() => handleBrowseClick(item.metadata)}
                      >
                        {/* Trending badge */}
                        <div className="absolute top-1 right-1 z-10">
                          <Badge variant="secondary" className="text-xs font-bold bg-orange-100 text-orange-700 border-orange-200 px-1 py-0 h-4 text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                        
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        <CardContent className="p-2 h-full flex flex-col justify-center items-center relative text-center">
                          {/* Brand Logo */}
                          <div className="mb-2">
                            <TrendingBrandLogo 
                              brandName={item.metadata}
                              logoUrl={getBrandLogoUrl(item.metadata)}
                              size="w-8 h-8"
                              textSize="text-sm"
                            />
                          </div>
                          
                          {/* Brand Name and Stats */}
                          <div className="space-y-1">
                            <h3 className="text-xs font-semibold group-hover:text-orange-700 transition-colors line-clamp-1 leading-tight">
                              {item.metadata
                                .split(' ')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                .join(' ')}
                            </h3>
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-2.5 w-2.5" />
                              <span className="text-xs">{item.count} clicks</span>
                            </div>
                          </div>
                          
                          {/* Browse Button (shows on hover) */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-orange-50/80 backdrop-blur-sm">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-6 px-2 text-xs font-medium hover:bg-orange-100 transition-all duration-300 whitespace-nowrap"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBrowseClick(item.metadata);
                              }}
                            >
                              <Star className="h-2.5 w-2.5 mr-1" />
                              <span className="text-xs">Browse</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Enhanced All Brands Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">All Brands</h2>
                  <p className="text-xs text-muted-foreground">Explore our complete brand collection</p>
                </div>
              </div>
              {displayedBrands.length > 0 && (
                <Badge variant="outline" className="text-xs px-2 py-1">
                  {displayedBrands.length} loaded
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {displayedBrands.map((brand, index) => (
                <Card
                  key={brand.id}
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:border-primary/40 bg-gradient-to-br from-background to-muted/20 border hover:scale-[1.02] relative overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 aspect-[4/3]"
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => handleBrowseClick(brand.title)}
                >
                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <CardContent className="p-2 h-full flex flex-col justify-center items-center relative text-center">
                    {/* Brand Logo */}
                    <div className="mb-2">
                      <BrandLogo 
                        brandName={brand.title}
                        logoUrl={brand.logoUrl}
                        size="h-8 w-8"
                        textSize="text-sm"
                      />
                    </div>
                    
                    {/* Brand Name */}
                    <div>
                      <h3 className="text-xs font-semibold group-hover:text-primary transition-colors line-clamp-1 leading-tight">
                        {brand.title}
                      </h3>
                    </div>
                    
                    {/* Browse Button (shows on hover) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-primary/5 backdrop-blur-sm">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-6 px-2 text-xs font-medium hover:bg-primary/10 transition-all duration-300 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBrowseClick(brand.title);
                        }}
                      >
                        <span className="text-xs">Browse</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Enhanced Loading more indicator */}
          {isLoadingMore && (
            <div className="flex justify-center py-12">
              <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 text-primary">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary"></div>
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-sm"></div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Loading more brands...</span>
                      <p className="text-xs text-muted-foreground">Discovering amazing products for you</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Load more sentinel */}
          {hasMore && !isLoadingMore && (
            <div id="load-more-sentinel" className="h-8 w-full"></div>
          )}

          {/* Enhanced End of results indicator */}
          {!hasMore && displayedBrands.length > 0 && displayedBrands.length === filteredAndSortedBrands.length && (
            <div className="text-center py-12">
              <Card className="max-w-md mx-auto border-2 border-muted/50 bg-gradient-to-br from-background to-muted/20">
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Package className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">All brands explored!</h3>
                      <p className="text-sm text-muted-foreground">
                        You've seen all <span className="font-semibold text-foreground">{filteredAndSortedBrands.length}</span> brands in this collection
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="mt-4"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Back to top
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Enhanced Empty state for search */}
          {displayedBrands.length === 0 && filteredAndSortedBrands.length === 0 && brands.length > 0 && (
            <div className="text-center py-20">
              <Card className="max-w-lg mx-auto border-2 border-muted/50 bg-gradient-to-br from-background to-muted/20">
                <CardContent className="p-12">
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-muted/50 to-muted/30 rounded-full flex items-center justify-center mx-auto">
                      <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">No brands found</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We couldn't find any brands matching "<span className="font-semibold text-foreground">{searchTerm}</span>". 
                        Try adjusting your search terms or browse all available brands.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={() => setSearchTerm("")} variant="default" className="h-11 px-8">
                        <Package className="h-4 w-4 mr-2" />
                        Show All Brands
                      </Button>
                      <Button variant="outline" className="h-11 px-8">
                        <Filter className="h-4 w-4 mr-2" />
                        Adjust Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Enhanced Empty state for API failure */}
          {brands.length === 0 && !loading && (
            <div className="text-center py-20">
              <Card className="max-w-lg mx-auto border-2 border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10">
                <CardContent className="p-12">
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-destructive/20 to-destructive/10 rounded-full flex items-center justify-center mx-auto">
                      <span className="text-3xl">⚠️</span>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">Unable to load brands</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        We're having trouble connecting to our brand database. 
                        Please check your connection and try again.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={() => window.location.reload()} variant="default" className="h-11 px-8">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Retry Loading
                      </Button>
                      <Button variant="outline" className="h-11 px-8">
                        <Building2 className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}