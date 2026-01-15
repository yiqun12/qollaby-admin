// Categories mapping - same as mobile app
export const categories = [
  {
    value: "creative-design",
    label: "Creative & Design",
    subCategories: [
      { value: "graphic-design", label: "Graphic Design" },
      { value: "ui-ux-design", label: "UI/UX Design" },
      { value: "illustration", label: "Illustration" },
      { value: "photography", label: "Photography" },
      { value: "videography", label: "Videography" },
      { value: "animation-motion-graphics", label: "Animation & Motion Graphics" },
      { value: "fashion-design", label: "Fashion Design" },
      { value: "interior-design", label: "Interior Design" },
    ],
  },
  {
    value: "technology-development",
    label: "Technology & Development",
    subCategories: [
      { value: "web-development", label: "Web Development" },
      { value: "mobile-app-development", label: "Mobile App Development" },
      { value: "software-engineering", label: "Software Engineering" },
      { value: "game-development", label: "Game Development" },
      { value: "ai-machine-learning", label: "AI & Machine Learning" },
      { value: "blockchain-web3", label: "Blockchain & Web3" },
      { value: "it-support", label: "IT Support" },
      { value: "cybersecurity", label: "Cybersecurity" },
    ],
  },
  {
    value: "marketing-business",
    label: "Marketing & Business",
    subCategories: [
      { value: "digital-marketing", label: "Digital Marketing" },
      { value: "seo-sem", label: "SEO & SEM" },
      { value: "social-media-management", label: "Social Media Management" },
      { value: "branding-strategy", label: "Branding & Strategy" },
      { value: "content-writing", label: "Content Writing" },
      { value: "market-research", label: "Market Research" },
      { value: "business-consulting", label: "Business Consulting" },
      { value: "sales", label: "Sales & Lead Generation" },
    ],
  },
  {
    value: "trades-skilled-work",
    label: "Trades & Skilled Work",
    subCategories: [
      { value: "carpentry", label: "Carpentry" },
      { value: "plumbing", label: "Plumbing" },
      { value: "electrical-work", label: "Electrical Work" },
      { value: "welding-fabrication", label: "Welding & Fabrication" },
      { value: "painting-decorating", label: "Painting & Decorating" },
      { value: "construction-renovation", label: "Construction & Renovation" },
      { value: "landscaping-gardening", label: "Landscaping & Gardening" },
      { value: "cleaning-services", label: "Cleaning Services" },
    ],
  },
  {
    value: "lifestyle-personal-services",
    label: "Lifestyle & Personal Services",
    subCategories: [
      { value: "fitness-training", label: "Fitness Training" },
      { value: "personal-coaching", label: "Personal Coaching" },
      { value: "beauty-wellness", label: "Beauty & Wellness" },
      { value: "pet-services", label: "Pet Services" },
      { value: "event-planning", label: "Event Planning" },
      { value: "travel-services", label: "Travel & Tours" },
    ],
  },
  {
    value: "education-learning",
    label: "Education & Learning",
    subCategories: [
      { value: "tutoring", label: "Tutoring" },
      { value: "online-courses", label: "Online Courses" },
      { value: "language-learning", label: "Language Learning" },
      { value: "test-prep", label: "Test Preparation" },
      { value: "music-lessons", label: "Music Lessons" },
      { value: "art-classes", label: "Art Classes" },
    ],
  },
  {
    value: "local-opportunities",
    label: "Local Opportunities",
    subCategories: [
      { value: "jobs", label: "Jobs & Work" },
      { value: "house-rentals", label: "House Rentals" },
      { value: "car-rentals", label: "Car Rentals" },
      { value: "garage-sales", label: "Garage Sales" },
      { value: "community-events", label: "Community Events" },
      { value: "volunteering", label: "Volunteering" },
    ],
  },
];

/**
 * Get category label by value
 */
export function getCategoryLabel(value: string | null | undefined): string {
  if (!value) return "N/A";
  const category = categories.find((c) => c.value === value);
  return category?.label || value;
}

/**
 * Get subcategory label by value
 */
export function getSubCategoryLabel(categoryValue: string | null | undefined, subCategoryValue: string | null | undefined): string {
  if (!subCategoryValue) return "N/A";
  if (!categoryValue) return subCategoryValue;
  
  const category = categories.find((c) => c.value === categoryValue);
  if (!category) return subCategoryValue;
  
  const subCategory = category.subCategories.find((s) => s.value === subCategoryValue);
  return subCategory?.label || subCategoryValue;
}
