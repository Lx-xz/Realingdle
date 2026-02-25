"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, Pencil, Plus, Trash2 } from "lucide-react"
import Cropper, { Area, Point } from "react-easy-crop"
import { useAuthSession } from "@/components/AuthSessionProvider"
import Button from "@/components/Button"
import DataTable from "@/components/DataTable"
import ScrollArea from "@/components/ScrollArea"
import Loading from "@/components/Loading"
import { supabase } from "@/lib/supabase"
import { fetchCharacters } from "@/lib/characters"
import {
  Association,
  Character,
  CharacterFormData,
  Class,
  Occupation,
  Place,
  Race,
  State,
} from "@/types"
import "./page.sass"

type TabType =
  | "characters"
  | "states"
  | "classes"
  | "races"
  | "occupations"
  | "associations"
  | "places"

const emptyCharacterFormData: CharacterFormData = {
  name: "",
  description: "",
  image_url: "",
  image_file: null,
  age: "",
  state_id: "",
  class_ids: [],
  race_ids: [],
  occupation_ids: [],
  association_ids: [],
  place_ids: [],
}

const characterColumnOptions = [
  { key: "image", label: "Image" },
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "age", label: "Age" },
  { key: "state", label: "State" },
  { key: "classes", label: "Classes" },
  { key: "races", label: "Races" },
  { key: "occupations", label: "Occupations" },
  { key: "associations", label: "Associations" },
  { key: "places", label: "Places" },
]

const defaultCharacterColumns = characterColumnOptions.map((column) =>
  column.key,
)

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = url
  })

const getCroppedImageFile = async (
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
) => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Unable to create crop canvas")
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92)
  })

  if (!blob) {
    throw new Error("Failed to generate cropped image")
  }

  return new File([blob], fileName, { type: "image/jpeg" })
}

const buildPlaceholderImageUrl = (name: string) => {
  const firstName = name.trim().split(/\s+/)[0] || "Character"
  return `https://placehold.co/400x500?text=${encodeURIComponent(firstName)}`
}

const isPlaceholderImageUrl = (url: string) =>
  url.trim().startsWith("https://placehold.co/400x500?text=") ||
  url.trim().startsWith("https://placehold.co/4:5?text=") ||
  url.trim().startsWith("https://placehold.co/200x400?text=")

const withTimeout = async <T,>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number,
  label: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race<T>([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const withRetry = async <T,>(
  run: () => Promise<T>,
  attempts: number,
  label: string,
) => {
  let lastError: unknown
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (index < attempts - 1) {
        await sleep(400 * 2 ** index)
      }
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

export default function GameSettingsPage() {
  const router = useRouter()
  const { user: sessionUser, isLoading: isSessionLoading } = useAuthSession()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("characters")
  const [characters, setCharacters] = useState<Character[]>([])
  const [states, setStates] = useState<State[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [occupations, setOccupations] = useState<Occupation[]>([])
  const [associations, setAssociations] = useState<Association[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isCharacterFormOpen, setIsCharacterFormOpen] = useState(false)
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(
    null,
  )
  const [characterFormData, setCharacterFormData] =
    useState<CharacterFormData>(emptyCharacterFormData)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropImageName, setCropImageName] = useState("character.jpg")
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [visibleCharacterColumns, setVisibleCharacterColumns] = useState(
    defaultCharacterColumns,
  )
  const [lookupIsAdding, setLookupIsAdding] = useState(false)
  const [lookupEditingId, setLookupEditingId] = useState<string | null>(null)
  const [lookupFormValue, setLookupFormValue] = useState("")
  const columnMenuRef = useRef<HTMLDivElement | null>(null)
  const columnStorageKey = "realingdle:character-columns"

  const optionMaps = useMemo(
    () => ({
      class_ids: classes,
      race_ids: races,
      occupation_ids: occupations,
      association_ids: associations,
      place_ids: places,
    }),
    [classes, races, occupations, associations, places],
  )

  useEffect(() => {
    if (characterFormData.image_file) {
      const previewUrl = URL.createObjectURL(characterFormData.image_file)
      setImagePreview(previewUrl)
      return () => {
        URL.revokeObjectURL(previewUrl)
      }
    }

    if (characterFormData.image_url.trim()) {
      const currentImageUrl = characterFormData.image_url.trim()
      setImagePreview(
        isPlaceholderImageUrl(currentImageUrl)
          ? buildPlaceholderImageUrl(characterFormData.name)
          : currentImageUrl,
      )
      return
    }

    setImagePreview(buildPlaceholderImageUrl(characterFormData.name))
  }, [
    characterFormData.image_file,
    characterFormData.image_url,
    characterFormData.name,
  ])

  useEffect(() => {
    if (!isColumnMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!columnMenuRef.current) return
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setIsColumnMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isColumnMenuOpen])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(columnStorageKey)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as string[]
      if (!Array.isArray(parsed)) return
      const allowed = new Set(characterColumnOptions.map((column) => column.key))
      const next = parsed.filter((key) => allowed.has(key))
      const required = ["image", "name"]
      const normalized = Array.from(new Set([...required, ...next]))
      setVisibleCharacterColumns(normalized)
    } catch {
      window.localStorage.removeItem(columnStorageKey)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      columnStorageKey,
      JSON.stringify(visibleCharacterColumns),
    )
  }, [visibleCharacterColumns])

  useEffect(() => {
    setLookupIsAdding(false)
    setLookupEditingId(null)
    setLookupFormValue("")
  }, [activeTab])

  useEffect(() => {
    if (isSessionLoading) {
      return
    }

    const hasSession = Boolean(sessionUser)
    const admin = sessionUser?.app_metadata?.role === "admin"
    setIsAuthenticated(hasSession)
    setIsAdmin(admin)

    if (!hasSession) {
      setCheckingAuth(false)
      router.replace("/auth?next=/game-settings")
      return
    }

    if (!admin) {
      setCheckingAuth(false)
      router.replace("/")
      return
    }

    setCheckingAuth(false)
  }, [router, sessionUser, isSessionLoading])

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return
    loadData()
  }, [isAuthenticated, isAdmin])

  const loadData = async () => {
    setLoading(true)
    setError("")
    try {
      await Promise.all([fetchCharactersList(), fetchLookups()])
    } catch (error) {
      console.error("Error loading configs data:", error)
      setError("Unable to load data. Please check your Supabase configuration.")
    } finally {
      setLoading(false)
    }
  }

  const fetchCharactersList = async () => {
    const data = await withRetry(
      () =>
        withTimeout(
          fetchCharacters({ ascending: false }),
          5500,
          "Settings characters fetch",
        ),
      1,
      "Settings characters fetch",
    )
    setCharacters(data)
  }

  const fetchLookups = async () => {
    const [
      statesRes,
      classesRes,
      racesRes,
      occupationsRes,
      associationsRes,
      placesRes,
    ] = await withRetry(
      () =>
        withTimeout(
          Promise.all([
            supabase.from("states").select("*").order("name", { ascending: true }),
            supabase.from("classes").select("*").order("name", { ascending: true }),
            supabase.from("races").select("*").order("name", { ascending: true }),
            supabase
              .from("occupations")
              .select("*")
              .order("name", { ascending: true }),
            supabase
              .from("associations")
              .select("*")
              .order("name", { ascending: true }),
            supabase.from("places").select("*").order("name", { ascending: true }),
          ]),
          5500,
          "Settings lookups fetch",
        ),
      1,
      "Settings lookups fetch",
    )

    const responses = [
      statesRes,
      classesRes,
      racesRes,
      occupationsRes,
      associationsRes,
      placesRes,
    ]

    const responseError = responses.find((response) => response.error)?.error
    if (responseError) {
      throw responseError
    }

    setStates((statesRes.data as State[]) || [])
    setClasses((classesRes.data as Class[]) || [])
    setRaces((racesRes.data as Race[]) || [])
    setOccupations((occupationsRes.data as Occupation[]) || [])
    setAssociations((associationsRes.data as Association[]) || [])
    setPlaces((placesRes.data as Place[]) || [])
  }

  const toggleSelection = (
    key:
      | "class_ids"
      | "race_ids"
      | "occupation_ids"
      | "association_ids"
      | "place_ids",
    value: string,
  ) => {
    setCharacterFormData((current) => {
      const list = current[key]
      const hasValue = list.includes(value)
      return {
        ...current,
        [key]: hasValue
          ? list.filter((item) => item !== value)
          : [...list, value],
      }
    })
  }

  const formatList = (items: { name: string }[]) =>
    items.length > 0 ? items.map((item) => item.name).join(", ") : "-"

  const resetCharacterForm = () => {
    setIsCharacterFormOpen(false)
    setEditingCharacterId(null)
    setCharacterFormData(emptyCharacterFormData)
    setOpenMenu(null)
    setIsCropModalOpen(false)
    setCropImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const handleCharacterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingCharacterId) {
      await handleEditCharacter(editingCharacterId, characterFormData)
    } else {
      await handleAddCharacter(characterFormData)
    }
    resetCharacterForm()
  }

  const handleCharacterEdit = (character: Character) => {
    setEditingCharacterId(character.id)
    setCharacterFormData({
      name: character.name,
      description: character.description || "",
      image_url: character.image_url || "",
      image_file: null,
      age: character.age ?? "",
      state_id: character.state?.id || "",
      class_ids: character.classes.map((item) => item.id),
      race_ids: character.races.map((item) => item.id),
      occupation_ids: character.occupations.map((item) => item.id),
      association_ids: character.associations.map((item) => item.id),
      place_ids: character.places.map((item) => item.id),
    })
    setIsCharacterFormOpen(true)
  }

  const openCropModal = (source: string, fileName: string) => {
    setCropImageSrc(source)
    setCropImageName(fileName)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setIsCropModalOpen(true)
  }

  const handleSelectImageFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const sourceUrl = URL.createObjectURL(file)
    openCropModal(sourceUrl, file.name || "character.jpg")
    event.target.value = ""
  }

  const handleRecropImage = () => {
    if (characterFormData.image_file) {
      const sourceUrl = URL.createObjectURL(characterFormData.image_file)
      openCropModal(
        sourceUrl,
        characterFormData.image_file.name || "character.jpg",
      )
      return
    }

    const existingImage = characterFormData.image_url.trim() || imagePreview
    if (!existingImage) return

    openCropModal(existingImage, `${characterFormData.name || "character"}.jpg`)
  }

  const handleDeleteImage = () => {
    const placeholderImageUrl = buildPlaceholderImageUrl(characterFormData.name)
    setCharacterFormData((current) => ({
      ...current,
      image_file: null,
      image_url: placeholderImageUrl,
    }))
  }

  const handleConfirmCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return

    try {
      const croppedFile = await getCroppedImageFile(
        cropImageSrc,
        croppedAreaPixels,
        cropImageName.replace(/\.[^/.]+$/, ".jpg"),
      )

      setCharacterFormData((current) => ({
        ...current,
        image_file: croppedFile,
      }))
      setIsCropModalOpen(false)
      URL.revokeObjectURL(cropImageSrc)
      setCropImageSrc(null)
    } catch (error) {
      console.error("Error cropping character image:", error)
      alert("Failed to crop image. Please try again.")
    }
  }

  const handleCancelCrop = () => {
    setIsCropModalOpen(false)
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc)
    }
    setCropImageSrc(null)
  }

  const handleCharacterCancel = () => {
    resetCharacterForm()
  }

  const handleOpenDetails = (character: Character) => {
    setDetailCharacter(character)
  }

  const handleCloseDetails = () => {
    setDetailCharacter(null)
  }

  const toggleCharacterColumn = (key: string) => {
    if (key === "image" || key === "name") return
    setVisibleCharacterColumns((current) => {
      const next = current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key]
      return characterColumnOptions
        .map((column) => column.key)
        .filter((columnKey) => next.includes(columnKey))
    })
  }

  const AttributePicker = ({
    label,
    fieldKey,
    options,
    selectedIds,
    onAdd,
    onRemove,
    single = false,
  }: {
    label: string
    fieldKey: string
    options: { id: string; name: string }[]
    selectedIds: string[]
    onAdd: (id: string) => void
    onRemove: (id: string) => void
    single?: boolean
  }) => {
    const ref = useRef<HTMLDivElement | null>(null)
    const isOpen = openMenu === fieldKey
    const selectedItems = options.filter((option) =>
      selectedIds.includes(option.id),
    )

    useEffect(() => {
      if (!isOpen) return
      const handleClickOutside = (event: MouseEvent) => {
        if (!ref.current) return
        if (!ref.current.contains(event.target as Node)) {
          setOpenMenu(null)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [isOpen])

    return (
      <div className="attribute-picker" ref={ref}>
        <div className="attribute-picker__header">
          <span className="attribute-picker__label">{label}</span>
          <button
            type="button"
            className="attribute-picker__add"
            onClick={() => setOpenMenu(isOpen ? null : fieldKey)}
          >
            <Plus size={14} />
          </button>
        </div>
        {isOpen && (
          <div className="attribute-picker__menu">
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`attribute-picker__option ${isSelected ? "is-selected" : ""}`}
                  onClick={() => {
                    if (single) {
                      onAdd(option.id)
                      setOpenMenu(null)
                      return
                    }
                    if (isSelected) {
                      onRemove(option.id)
                    } else {
                      onAdd(option.id)
                    }
                  }}
                >
                  <span>{option.name}</span>
                  {isSelected && (
                    <span className="attribute-picker__check">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        <div className="attribute-picker__tags">
          {selectedItems.length === 0 ? (
            <span className="attribute-picker__empty">None</span>
          ) : (
            selectedItems.map((item) => (
              <span key={item.id} className="attribute-picker__tag">
                {item.name}
                <button
                  type="button"
                  className="attribute-picker__remove"
                  onClick={() => onRemove(item.id)}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    )
  }

  const buildCharacterPayload = (
    character: CharacterFormData,
    imageUrl?: string | null,
  ) => ({
    name: character.name.trim(),
    description: character.description.trim() || null,
    image_url: imageUrl ?? (character.image_url.trim() || null),
    age: character.age === "" ? null : character.age,
    state_id: character.state_id || null,
  })

  const uploadCharacterImage = async (file: File) => {
    const bucket = "characters"
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-")
    const filePath = `${Date.now()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    return data.publicUrl
  }

  const resolveImageUrl = async (character: CharacterFormData) => {
    if (!character.image_file) return null
    return uploadCharacterImage(character.image_file)
  }

  const syncJoinTable = async (
    table: string,
    column: string,
    characterId: string,
    ids: string[],
  ) => {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("character_id", characterId)

    if (deleteError) {
      throw deleteError
    }

    if (ids.length === 0) return

    const payload = ids.map((id) => ({
      character_id: characterId,
      [column]: id,
    }))

    const { error: insertError } = await supabase.from(table).insert(payload)
    if (insertError) {
      throw insertError
    }
  }

  const syncCharacterRelations = async (
    characterId: string,
    character: CharacterFormData,
  ) => {
    await Promise.all([
      syncJoinTable(
        "character_classes",
        "class_id",
        characterId,
        character.class_ids,
      ),
      syncJoinTable(
        "character_races",
        "race_id",
        characterId,
        character.race_ids,
      ),
      syncJoinTable(
        "character_occupations",
        "occupation_id",
        characterId,
        character.occupation_ids,
      ),
      syncJoinTable(
        "character_associations",
        "association_id",
        characterId,
        character.association_ids,
      ),
      syncJoinTable(
        "character_places",
        "place_id",
        characterId,
        character.place_ids,
      ),
    ])
  }

  const handleAddCharacter = async (character: CharacterFormData) => {
    try {
      const uploadedImageUrl = await resolveImageUrl(character)
      const imageUrlToSave =
        uploadedImageUrl ||
        character.image_url.trim() ||
        buildPlaceholderImageUrl(character.name)

      const { data, error } = await supabase
        .from("characters")
        .insert([buildCharacterPayload(character, imageUrlToSave)])
        .select("id")
        .single()

      if (error) throw error

      await syncCharacterRelations(data.id, character)

      await fetchCharactersList()
    } catch (error) {
      console.error("Error adding character:", error)
      alert("Error adding character. Please check your Supabase configuration.")
    }
  }

  const handleEditCharacter = async (
    id: string,
    character: CharacterFormData,
  ) => {
    try {
      const uploadedImageUrl = await resolveImageUrl(character)
      const { error } = await supabase
        .from("characters")
        .update(buildCharacterPayload(character, uploadedImageUrl))
        .eq("id", id)

      if (error) throw error
      await syncCharacterRelations(id, character)
      await fetchCharactersList()
    } catch (error) {
      console.error("Error updating character:", error)
      alert("Error updating character. Please check your Supabase configuration.")
    }
  }

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("Are you sure you want to delete this character?")) return

    try {
      const { error } = await supabase.from("characters").delete().eq("id", id)

      if (error) throw error
      await fetchCharactersList()
    } catch (error) {
      console.error("Error deleting character:", error)
      alert("Error deleting character. Please check your Supabase configuration.")
    }
  }

  const createLookupHandlers = (
    table: string,
    setter: (data: any[]) => void,
  ) => ({
    onAdd: async (name: string) => {
      try {
        const { error } = await supabase.from(table).insert([{ name }])
        if (error) throw error
        await fetchLookups()
      } catch (error) {
        console.error(`Error adding ${table}:`, error)
        alert(`Error adding ${table}. Please try again.`)
      }
    },
    onEdit: async (id: string, name: string) => {
      try {
        const { error } = await supabase
          .from(table)
          .update({ name })
          .eq("id", id)
        if (error) throw error
        await fetchLookups()
      } catch (error) {
        console.error(`Error updating ${table}:`, error)
        alert(`Error updating ${table}. Please try again.`)
      }
    },
    onDelete: async (id: string) => {
      if (!confirm(`Are you sure you want to delete this item?`)) return
      try {
        const { error } = await supabase.from(table).delete().eq("id", id)
        if (error) throw error
        await fetchLookups()
      } catch (error) {
        console.error(`Error deleting ${table}:`, error)
        alert(`Error deleting ${table}. Please try again.`)
      }
    },
  })

  const stateHandlers = createLookupHandlers("states", setStates)
  const classHandlers = createLookupHandlers("classes", setClasses)
  const raceHandlers = createLookupHandlers("races", setRaces)
  const occupationHandlers = createLookupHandlers("occupations", setOccupations)
  const associationHandlers = createLookupHandlers(
    "associations",
    setAssociations,
  )
  const placeHandlers = createLookupHandlers("places", setPlaces)

  const lookupConfigs: Record<
    Exclude<TabType, "characters">,
    {
      title: string
      items: { id: string; name: string }[]
      handlers: {
        onAdd: (name: string) => Promise<void>
        onEdit: (id: string, name: string) => Promise<void>
        onDelete: (id: string) => Promise<void>
      }
    }
  > = {
    states: { title: "States", items: states, handlers: stateHandlers },
    classes: { title: "Classes", items: classes, handlers: classHandlers },
    races: { title: "Races", items: races, handlers: raceHandlers },
    occupations: {
      title: "Occupations",
      items: occupations,
      handlers: occupationHandlers,
    },
    associations: {
      title: "Associations",
      items: associations,
      handlers: associationHandlers,
    },
    places: { title: "Places", items: places, handlers: placeHandlers },
  }

  const activeLookup =
    activeTab === "characters" ? null : lookupConfigs[activeTab]

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeLookup) return
    if (!lookupFormValue.trim()) return

    if (lookupEditingId) {
      await activeLookup.handlers.onEdit(
        lookupEditingId,
        lookupFormValue.trim(),
      )
    } else {
      await activeLookup.handlers.onAdd(lookupFormValue.trim())
    }

    setLookupFormValue("")
    setLookupEditingId(null)
    setLookupIsAdding(false)
  }

  const handleLookupEdit = (item: { id: string; name: string }) => {
    setLookupEditingId(item.id)
    setLookupFormValue(item.name)
    setLookupIsAdding(true)
  }

  const handleLookupCancel = () => {
    setLookupIsAdding(false)
    setLookupEditingId(null)
    setLookupFormValue("")
  }

  const visibleCharacterColumnDefs = characterColumnOptions.filter((column) =>
    visibleCharacterColumns.includes(column.key),
  )
  const hasHiddenCharacterColumns =
    visibleCharacterColumns.length < characterColumnOptions.length
  const hiddenCharacterColumns = characterColumnOptions.filter(
    (column) => !visibleCharacterColumns.includes(column.key),
  )
  const allCharacterColumnsSelected =
    visibleCharacterColumns.length === characterColumnOptions.length
  const requiredCharacterColumns = ["image", "name"]

  const handleSelectAllColumns = () => {
    setVisibleCharacterColumns(characterColumnOptions.map((column) => column.key))
  }

  const handleDeselectAllColumns = () => {
    setVisibleCharacterColumns(requiredCharacterColumns)
  }

  const canRecropCurrentImage =
    Boolean(characterFormData.image_file) ||
    (Boolean(characterFormData.image_url.trim()) &&
      !isPlaceholderImageUrl(characterFormData.image_url))

  if (checkingAuth) {
    return (
      <div className="configs">
        <div className="configs__loading">
          <Loading label="Checking access..." />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="configs">
        <div className="configs__loading">Redirecting to login...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="configs">
        <div className="configs__loading">Access denied.</div>
      </div>
    )
  }

  return (
    <div className="configs">
      <div className="configs__container">
        {error && <p className="configs__error">{error}</p>}

        <div className="configs__tabs">
          <button
            className={`configs__tab ${activeTab === "characters" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("characters")}
          >
            Characters
          </button>
          <button
            className={`configs__tab ${activeTab === "states" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("states")}
          >
            States
          </button>
          <button
            className={`configs__tab ${activeTab === "classes" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("classes")}
          >
            Classes
          </button>
          <button
            className={`configs__tab ${activeTab === "races" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("races")}
          >
            Races
          </button>
          <button
            className={`configs__tab ${activeTab === "occupations" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("occupations")}
          >
            Occupations
          </button>
          <button
            className={`configs__tab ${activeTab === "associations" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("associations")}
          >
            Associations
          </button>
          <button
            className={`configs__tab ${activeTab === "places" ? "configs__tab--active" : ""}`}
            onClick={() => setActiveTab("places")}
          >
            Places
          </button>
        </div>

        {loading ? (
          <div className="configs__loading">
            <Loading label="Loading data..." />
          </div>
        ) : (
          <div className="configs__content">
            {activeTab === "characters" && (
              <div className="character-table">
                <div className="character-table__header">
                  <h2>Characters</h2>
                  <div className="configs__table-toolbar">
                    <div
                      className="configs__column-picker"
                      ref={columnMenuRef}
                    >
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setIsColumnMenuOpen((open) => !open)
                        }
                      >
                        Columns
                      </Button>
                      {isColumnMenuOpen && (
                        <div className="configs__column-menu">
                          <div className="configs__column-actions">
                            <button
                              type="button"
                              className="configs__column-action"
                              onClick={handleSelectAllColumns}
                              disabled={allCharacterColumnsSelected}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              className="configs__column-action"
                              onClick={handleDeselectAllColumns}
                              disabled={
                                visibleCharacterColumns.length ===
                                requiredCharacterColumns.length
                              }
                            >
                              Deselect all
                            </button>
                          </div>
                          {characterColumnOptions.map((column) => (
                            <label
                              key={column.key}
                              className="configs__column-option"
                            >
                              <input
                                type="checkbox"
                                checked={visibleCharacterColumns.includes(
                                  column.key,
                                )}
                                onChange={() =>
                                  toggleCharacterColumn(column.key)
                                }
                                disabled={
                                  column.key === "image" ||
                                  column.key === "name"
                                }
                              />
                              <span>{column.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isCharacterFormOpen && (
                      <Button onClick={() => setIsCharacterFormOpen(true)}>
                        <span className="button__icon">
                          <Plus size={18} />
                        </span>
                        Add Character
                      </Button>
                    )}
                  </div>
                </div>

                {isCharacterFormOpen && (
                  <form
                    className="character-form"
                    onSubmit={handleCharacterSubmit}
                  >
                    <div className="character-form__grid">
                      <div className="character-form__field character-form__field--wide">
                        <label>Image</label>
                        <div className="character-form__media">
                          <div className="character-form__media-preview">
                            {imagePreview ? (
                              <img src={imagePreview} alt="Preview" />
                            ) : (
                              <span>No preview</span>
                            )}
                          </div>
                          <div className="character-form__media-controls">
                            <div className="character-form__file">
                              <input
                                id="image_file"
                                type="file"
                                accept="image/*"
                                className="character-form__file-input"
                                onChange={handleSelectImageFile}
                              />
                              <label
                                htmlFor="image_file"
                                className="character-form__file-button"
                              >
                                {canRecropCurrentImage
                                  ? "Select new file"
                                  : "Choose file"}
                              </label>
                              <span className="character-form__file-name">
                                {characterFormData.image_file?.name ||
                                  "No file selected"}
                              </span>
                            </div>
                            <span className="character-form__file-hint">
                              Image will be cropped to a 4:5 ratio before saving.
                            </span>
                            <div className="character-form__image-actions">
                              <button
                                type="button"
                                className="character-form__file-button"
                                onClick={handleRecropImage}
                                disabled={!canRecropCurrentImage}
                              >
                                Recrop image
                              </button>
                              <button
                                type="button"
                                className="character-form__file-button character-form__file-button--danger"
                                onClick={handleDeleteImage}
                                disabled={!canRecropCurrentImage}
                              >
                                Delete image
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="character-form__row character-form__row--two">
                        <div className="character-form__field">
                          <label htmlFor="name">Name</label>
                          <input
                            id="name"
                            type="text"
                            value={characterFormData.name}
                            onChange={(e) =>
                              setCharacterFormData({
                                ...characterFormData,
                                name: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="character-form__field">
                          <label htmlFor="age">Age</label>
                          <input
                            id="age"
                            type="number"
                            min={0}
                            value={characterFormData.age}
                            onChange={(e) =>
                              setCharacterFormData({
                                ...characterFormData,
                                age:
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="character-form__attributes">
                        <AttributePicker
                          label="State"
                          fieldKey="state_id"
                          options={states}
                          selectedIds={
                            characterFormData.state_id
                              ? [characterFormData.state_id]
                              : []
                          }
                          onAdd={(id) =>
                            setCharacterFormData({
                              ...characterFormData,
                              state_id: id,
                            })
                          }
                          onRemove={() =>
                            setCharacterFormData({
                              ...characterFormData,
                              state_id: "",
                            })
                          }
                          single
                        />
                        <AttributePicker
                          label="Classes"
                          fieldKey="class_ids"
                          options={optionMaps.class_ids}
                          selectedIds={characterFormData.class_ids}
                          onAdd={(id) => toggleSelection("class_ids", id)}
                          onRemove={(id) => toggleSelection("class_ids", id)}
                        />
                        <AttributePicker
                          label="Races"
                          fieldKey="race_ids"
                          options={optionMaps.race_ids}
                          selectedIds={characterFormData.race_ids}
                          onAdd={(id) => toggleSelection("race_ids", id)}
                          onRemove={(id) => toggleSelection("race_ids", id)}
                        />
                        <AttributePicker
                          label="Occupations"
                          fieldKey="occupation_ids"
                          options={optionMaps.occupation_ids}
                          selectedIds={characterFormData.occupation_ids}
                          onAdd={(id) =>
                            toggleSelection("occupation_ids", id)
                          }
                          onRemove={(id) =>
                            toggleSelection("occupation_ids", id)
                          }
                        />
                        <AttributePicker
                          label="Associations"
                          fieldKey="association_ids"
                          options={optionMaps.association_ids}
                          selectedIds={characterFormData.association_ids}
                          onAdd={(id) =>
                            toggleSelection("association_ids", id)
                          }
                          onRemove={(id) =>
                            toggleSelection("association_ids", id)
                          }
                        />
                        <AttributePicker
                          label="Places"
                          fieldKey="place_ids"
                          options={optionMaps.place_ids}
                          selectedIds={characterFormData.place_ids}
                          onAdd={(id) => toggleSelection("place_ids", id)}
                          onRemove={(id) => toggleSelection("place_ids", id)}
                        />
                      </div>
                      <div className="character-form__field">
                        <label htmlFor="description">Description</label>
                        <textarea
                          id="description"
                          value={characterFormData.description}
                          onChange={(e) =>
                            setCharacterFormData({
                              ...characterFormData,
                              description: e.target.value,
                            })
                          }
                          rows={3}
                          placeholder="Optional description"
                        />
                      </div>
                    </div>
                    <div className="character-form__actions">
                      <Button type="submit">
                        <span className="button__icon">
                          {editingCharacterId ? (
                            <Pencil size={16} />
                          ) : (
                            <Plus size={16} />
                          )}
                        </span>
                        {editingCharacterId
                          ? "Update Character"
                          : "Add Character"}
                      </Button>
                      <Button variant="secondary" onClick={handleCharacterCancel}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {isCropModalOpen && cropImageSrc && (
                  <div className="character-form__crop-modal" role="dialog" aria-modal="true">
                    <div className="character-form__crop-card">
                      <h3>Crop Image</h3>
                      <div className="character-form__crop-area">
                        <Cropper
                          image={cropImageSrc}
                          crop={crop}
                          zoom={zoom}
                          aspect={4 / 5}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={(_, croppedPixels) =>
                            setCroppedAreaPixels(croppedPixels)
                          }
                        />
                      </div>
                      <div className="character-form__crop-zoom">
                        <label htmlFor="crop_zoom">Zoom</label>
                        <input
                          id="crop_zoom"
                          type="range"
                          min={1}
                          max={3}
                          step={0.01}
                          value={zoom}
                          onChange={(event) => setZoom(Number(event.target.value))}
                        />
                      </div>
                      <div className="character-form__actions">
                        <Button type="button" onClick={handleConfirmCrop}>
                          Apply Crop
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleCancelCrop}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="character-table__table-shell">
                  <div className="character-table__scroll-shell">
                    <ScrollArea
                      className="character-table__table-scroll"
                      showHorizontal
                    >
                      <div className="character-table__table-clip">
                        <DataTable
                          className="character-table__table"
                          columns={[
                            ...visibleCharacterColumnDefs.map((column) => ({
                              key: column.key,
                              label: column.label,
                            })),
                            {
                              key: "actions",
                              label: "Actions",
                              className: "character-table__cell--actions",
                            },
                          ]}
                        >
                        {characters.length === 0 ? (
                          <tr>
                            <td
                              colSpan={visibleCharacterColumnDefs.length + 1}
                              className="character-table__empty"
                            >
                              No characters found. Add one to get started!
                            </td>
                          </tr>
                        ) : (
                          characters.map((character) => (
                            <tr key={character.id}>
                              {visibleCharacterColumns.includes("image") && (
                                <td>
                                  {character.image_url ? (
                                    <img
                                      src={character.image_url}
                                      alt={character.name}
                                      className="character-table__image-preview"
                                    />
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              )}
                              {visibleCharacterColumns.includes("name") && (
                                <td>{character.name}</td>
                              )}
                              {visibleCharacterColumns.includes("description") && (
                                <td>{character.description || "-"}</td>
                              )}
                              {visibleCharacterColumns.includes("age") && (
                                <td>{character.age || "-"}</td>
                              )}
                              {visibleCharacterColumns.includes("state") && (
                                <td>{character.state?.name || "-"}</td>
                              )}
                              {visibleCharacterColumns.includes("classes") && (
                                <td>{formatList(character.classes)}</td>
                              )}
                              {visibleCharacterColumns.includes("races") && (
                                <td>{formatList(character.races)}</td>
                              )}
                              {visibleCharacterColumns.includes("occupations") && (
                                <td>{formatList(character.occupations)}</td>
                              )}
                              {visibleCharacterColumns.includes("associations") && (
                                <td>{formatList(character.associations)}</td>
                              )}
                              {visibleCharacterColumns.includes("places") && (
                                <td>{formatList(character.places)}</td>
                              )}
                              <td className="character-table__cell--actions">
                                <div className="character-table__actions">
                                  {hasHiddenCharacterColumns && (
                                    <Button
                                      variant="secondary"
                                      onClick={() => handleOpenDetails(character)}
                                    >
                                      <span className="button__icon">
                                        <Eye size={16} />
                                      </span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="secondary"
                                    onClick={() => handleCharacterEdit(character)}
                                  >
                                    <span className="button__icon">
                                      <Pencil size={16} />
                                    </span>
                                  </Button>
                                  <Button
                                    variant="danger"
                                    onClick={() => handleDeleteCharacter(character.id)}
                                  >
                                    <span className="button__icon">
                                      <Trash2 size={16} />
                                    </span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                        </DataTable>
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {detailCharacter && hasHiddenCharacterColumns && (
                  <div
                    className="character-table__modal"
                    role="dialog"
                    aria-modal="true"
                    onClick={handleCloseDetails}
                  >
                    <div
                      className="character-table__modal-card"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="character-table__modal-header">
                        <h3>{detailCharacter.name}</h3>
                        <Button
                          variant="secondary"
                          onClick={handleCloseDetails}
                        >
                          Fechar
                        </Button>
                      </div>
                      <div className="character-table__modal-body">
                        {hiddenCharacterColumns.map((column) => {
                          const valueMap: Record<string, string> = {
                            description: detailCharacter.description || "-",
                            places: formatList(detailCharacter.places),
                            state: detailCharacter.state?.name || "-",
                            age: String(detailCharacter.age ?? "-"),
                            classes: formatList(detailCharacter.classes),
                            races: formatList(detailCharacter.races),
                            occupations: formatList(detailCharacter.occupations),
                            associations: formatList(detailCharacter.associations),
                            image: detailCharacter.image_url || "-",
                            name: detailCharacter.name,
                          }

                          return (
                            <div
                              key={column.key}
                              className="character-table__modal-row"
                            >
                              <span className="character-table__modal-label">
                                {column.label}
                              </span>
                              <span className="character-table__modal-value">
                                {valueMap[column.key] ?? "-"}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeLookup && (
              <div className="lookup-table">
                <div className="lookup-table__header">
                  <h2>{activeLookup.title}</h2>
                  {!lookupIsAdding && (
                    <Button onClick={() => setLookupIsAdding(true)}>
                      <span className="button__icon">
                        <Plus size={16} />
                      </span>
                      Add {activeLookup.title.slice(0, -1)}
                    </Button>
                  )}
                </div>

                {lookupIsAdding && (
                  <form
                    className="lookup-table__form"
                    onSubmit={handleLookupSubmit}
                  >
                    <div className="lookup-table__field">
                      <label htmlFor="name">Name</label>
                      <input
                        id="name"
                        type="text"
                        value={lookupFormValue}
                        onChange={(e) => setLookupFormValue(e.target.value)}
                        required
                        placeholder={`Enter ${activeLookup.title
                          .toLowerCase()
                          .slice(0, -1)} name`}
                        autoFocus
                      />
                    </div>
                    <div className="lookup-table__actions">
                      <Button type="submit">
                        <span className="button__icon">
                          {lookupEditingId ? (
                            <Pencil size={16} />
                          ) : (
                            <Plus size={16} />
                          )}
                        </span>
                        {lookupEditingId ? "Update" : "Add"}
                      </Button>
                      <Button variant="secondary" onClick={handleLookupCancel}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                <div className="lookup-table__list">
                  {activeLookup.items.length === 0 ? (
                    <div className="lookup-table__empty">
                      No {activeLookup.title.toLowerCase()} found. Add one to get
                      started!
                    </div>
                  ) : (
                    <DataTable
                      className="lookup-table__table"
                      columns={[
                        { key: "name", label: "Name" },
                        {
                          key: "actions",
                          label: "Actions",
                          className: "lookup-table__cell--actions",
                        },
                      ]}
                    >
                      {activeLookup.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td className="lookup-table__cell--actions">
                            <div className="lookup-table__row-actions">
                              <Button
                                variant="secondary"
                                onClick={() => handleLookupEdit(item)}
                              >
                                <span className="button__icon">
                                  <Pencil size={16} />
                                </span>
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() =>
                                  activeLookup.handlers.onDelete(item.id)
                                }
                              >
                                <span className="button__icon">
                                  <Trash2 size={16} />
                                </span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </DataTable>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
