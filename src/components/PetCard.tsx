import { Pet } from "../types/pet";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";

interface PetCardProps {
  pet: Pet;
  onTrialDay: (pet: Pet) => void;
  onAdopt: (pet: Pet) => void;
  onSelect?: (id: string) => void;
  isAdmin?: boolean;
  isBooked?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (pet: Pet) => void;
}

export function PetCard({ pet, onTrialDay, onAdopt, isAdmin, isBooked = false, onDelete, onEdit, onSelect }: PetCardProps) {
  return (
    <Card
      className="bg-white border-amber-100 hover:shadow-lg transition-shadow duration-300 overflow-hidden card-hover cursor-pointer"
      onClick={() => onSelect?.(pet.id)}
    >
      <div className="relative h-48 bg-amber-50">
        <img
          src={pet.photo_url || pet.imageUrl}
          alt={pet.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop";
          }}
        />
      </div>
      <CardHeader className="pb-3">
        <CardTitle className="text-amber-900 flex items-center justify-between">
          {pet.name}
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
            {pet.type === "cat" ? "Кіт" : "Собака"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-amber-800">Порода:</span> {pet.breed_visual || "Не вказано"}
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-amber-800">Вік:</span> {pet.age_months != null ? `${pet.age_months} міс.` : "Не вказано"}
        </p>


        <p className="text-sm text-slate-600 line-clamp-2">
          <span className="font-medium text-amber-800">Характер:</span>{" "}
          {Array.isArray(pet.temperament_tags) && pet.temperament_tags.length > 0
            ? pet.temperament_tags.join(", ")
            : "Не вказано"}
        </p>

        {pet.description && (
          <p className="text-sm text-slate-600 line-clamp-2">
            <span className="font-medium text-amber-800">Опис:</span> {pet.description}
          </p>
        )}


        <div className="pt-2 mt-2 border-t border-amber-100">
          <p className="text-sm text-slate-600 font-medium flex items-center gap-1">
            💰 {pet.monthly_cost ? `${pet.monthly_cost} грн/міс` : "0 грн/міс"}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-0">
        {!isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={(e) => {
                e.stopPropagation();
                onTrialDay(pet);
              }}
              disabled={isBooked}
            >
              Тестовий день
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                onAdopt(pet);
              }}
              disabled={isBooked}
            >
              {isBooked ? "Заброньовано" : "Забрати додому"}
            </Button>
          </div>
        )}
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1 text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(pet);
              }}
            >
              Редагувати
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 border-red-300"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(pet.id);
              }}
            >
              Видалити
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
